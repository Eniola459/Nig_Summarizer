from flask import Flask, request, jsonify
from flask_cors import CORS
from rouge import Rouge
import mysql.connector
import time
from nltk.tokenize import sent_tokenize, word_tokenize
from nltk.corpus import stopwords
from collections import defaultdict
import nltk
import requests
import os
import logging

app = Flask(__name__)
CORS(app)

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Ensure NLTK resources are available
try:
    nltk.download('punkt')
    nltk.download('stopwords')
except Exception as e:
    logger.error(f"Error downloading NLTK resources: {e}")

# Database configuration
db_config = {
    "host": os.getenv("DB_HOST", "localhost"),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME", "nigerian_constitution")
}

def get_db_connection():
    return mysql.connector.connect(**db_config)

# Helper function to perform search by keyword, section, subsection, or paragraph
def perform_search(keyword=None, filter_type='all', sub_filter='', section_number=None):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        query = """
            SELECT 
                c.chapter_number AS chapter, 
                p.part_number AS part, 
                s.section_number AS section, 
                sub.subsection_number AS subsection,
                sub.paragraph_letter AS paragraph,  -- Changed to paragraph_letter
                sub.content AS content
            FROM section s
            LEFT JOIN part p ON s.part_id = p.part_id
            LEFT JOIN chapter c ON p.chapter_id = c.chapter_id
            LEFT JOIN subsection sub ON s.section_id = sub.section_id
        """
        params = []

        if keyword:
            query += " WHERE (s.title LIKE %s OR sub.content LIKE %s)"
            params.extend(['%' + keyword + '%', '%' + keyword + '%'])
        elif filter_type != 'all':
            query += " WHERE "
            if filter_type == 'chapter':
                query += "c.chapter_number = %s"
                params.append(sub_filter)
            elif filter_type == 'part':
                query += "p.part_number = %s"
                params.append(sub_filter)
            elif filter_type == 'section':
                query += "s.section_number = %s"
                params.append(sub_filter)
            elif filter_type == 'subsection' and section_number:
                query += "s.section_number = %s AND sub.subsection_number = %s"
                params.extend([section_number, sub_filter])
            elif filter_type == 'paragraph' and section_number:
                query += "s.section_number = %s AND sub.paragraph_letter = %s"
                params.extend([section_number, sub_filter])

        cursor.execute(query, params)
        results = cursor.fetchall()

        if keyword:
            valid_results = [r for r in results if r['content'] and keyword.lower() in r['content'].lower()]
        else:
            if filter_type == 'section':
                valid_results = [r for r in results if r['content'] and r['subsection'] == '1']  # Default to Subsection 1
            elif filter_type == 'subsection':
                valid_results = [r for r in results if r['content'] and r['subsection'] == sub_filter]
            elif filter_type == 'paragraph':
                valid_results = [r for r in results if r['content'] and r['paragraph'] == sub_filter]
            else:
                valid_results = [r for r in results if r['content']]

        content = ' '.join([r['content'] for r in valid_results])
        return content, valid_results[:1]  # Return first result for precision

    except Exception as e:
        logger.error(f"Error in perform_search: {str(e)}")
        raise
    finally:
        cursor.close()
        conn.close()

# -- FILTER/DROPDOWN APIs (CHAPTER, PART, SECTION, SUBSECTION, PARAGRAPH) ----
@app.route('/api/filters/<level>', methods=['GET'])
def get_filters(level):
    conn = get_db_connection()
    cursor = conn.cursor()
    parent_id = request.args.get('parent_id')

    try:
        if level == "chapter":
            cursor.execute("SELECT DISTINCT chapter_number FROM chapter ORDER BY chapter_id")
            data = [row[0] for row in cursor.fetchall()]
        elif level == "part" and parent_id:
            cursor.execute("SELECT DISTINCT part_number FROM part WHERE chapter_id = (SELECT chapter_id FROM chapter WHERE chapter_number = %s)", (parent_id,))
            data = [row[0] for row in cursor.fetchall()]
        elif level == "section" and parent_id:
            cursor.execute("""
                SELECT DISTINCT s.section_number 
                FROM section s 
                JOIN part p ON s.part_id = p.part_id 
                WHERE p.part_number = %s ORDER BY s.section_number
            """, (parent_id,))
            data = [row[0] for row in cursor.fetchall()]
        elif level == "subsection" and parent_id:
            cursor.execute("""
                SELECT DISTINCT sub.subsection_number 
                FROM subsection sub 
                JOIN section s ON sub.section_id = s.section_id 
                WHERE s.section_number = %s ORDER BY sub.subsection_number
            """, (parent_id,))
            data = [row[0] for row in cursor.fetchall()]
        elif level == "paragraph" and parent_id:
            cursor.execute("""
                SELECT DISTINCT sub.paragraph_letter 
                FROM subsection sub 
                JOIN section s ON sub.section_id = s.section_id 
                WHERE s.section_number = %s ORDER BY sub.paragraph_letter
            """, (parent_id,))
            data = [row[0] for row in cursor.fetchall() if row[0] is not None]  # Filter out NULLs
        else:
            data = []

        return jsonify({'data': data, 'success': True})

    except Exception as e:
        logger.error(f"Error in get_filters: {str(e)}")
        return jsonify({'error': str(e), 'success': False}), 500
    finally:
        cursor.close()
        conn.close()

# --- TEXT SEARCH (KEYWORD-BASED OR SECTION/SUBSECTION/PARAGRAPH-BASED) ----
@app.route('/search', methods=['POST'])
def search_constitution():
    start_time = time.time()

    data = request.json
    keyword = data.get('keyword', '').strip().lower() if 'keyword' in data else None
    filter_type = data.get('filter', 'all')
    sub_filter = data.get('subFilter', '')
    section_number = data.get('section_number', None)

    if not keyword and filter_type == 'all':
        return jsonify({'error': 'Provide either a keyword or a filter with subFilter', 'success': False}), 400
    if filter_type in ['subsection', 'paragraph'] and not section_number:
        return jsonify({'error': 'Section number required for subsection or paragraph search', 'success': False}), 400

    try:
        content, results = perform_search(keyword, filter_type, sub_filter, section_number)
        formatted_results = [{'content': r['content']} for r in results]

        end_time = time.time()
        processing_time = end_time - start_time

        return jsonify({
            'results': formatted_results,
            'metrics': {
                'result_count': len(formatted_results),
                'processing_time': f"{processing_time:.3f} seconds"
            },
            'success': True
        })

    except Exception as e:
        logger.error(f"Error in search_constitution: {str(e)}")
        return jsonify({'error': f"Database error: {str(e)}", 'success': False}), 500

# ----- TEXT SUMMARIZATION ----
@app.route('/summarize', methods=['POST'])
def summarize():
    start_time = time.time()

    data = request.json
    keyword = data.get('keyword', '').strip().lower() if 'keyword' in data else None
    filter_type = data.get('filter', 'all')
    sub_filter = data.get('subFilter', '')
    section_number = data.get('section_number', None)

    if not keyword and filter_type == 'all':
        return jsonify({'error': 'Provide either a keyword or a filter with subFilter', 'success': False}), 400
    if filter_type in ['subsection', 'paragraph'] and not section_number:
        return jsonify({'error': 'Section number required for subsection or paragraph search', 'success': False}), 400

    try:
        text, _ = perform_search(keyword, filter_type, sub_filter, section_number)
        
        if not text:
            return jsonify({'error': 'No content found for the search query', 'success': False}), 404

        sentences = sent_tokenize(text)
        stop_words = set(stopwords.words('english'))
        sentence_scores = defaultdict(float)

        for i, sentence in enumerate(sentences):
            words = [word.lower() for word in word_tokenize(sentence) if word.lower() not in stop_words]
            for j, other_sentence in enumerate(sentences):
                if i != j:
                    other_words = [word.lower() for word in word_tokenize(other_sentence) if word.lower() not in stop_words]
                    common_words = set(words) & set(other_words)
                    score = len(common_words) / (len(words) + len(other_words) - len(common_words) + 1e-10)
                    sentence_scores[sentence] += score

        num_sentences = max(1, int(len(sentences) * 0.3))
        sorted_sentences = sorted(sentence_scores.items(), key=lambda x: x[1], reverse=True)
        summary_sentences = [sent for sent, score in sorted_sentences[:num_sentences]]
        summary_sentences.sort(key=lambda x: sentences.index(x))
        summary = ' '.join(summary_sentences)

        rouge = Rouge()
        rouge_scores = rouge.get_scores(summary, text)[0]
        end_time = time.time()
        processing_time = end_time - start_time

        return jsonify({
            'summary': summary,
            'metrics': {
                'original_length': len(text),
                'summary_length': len(summary),
                'original_sentences': len(sentences),
                'summary_sentences': len(summary_sentences),
                'compression_ratio': f"{(len(summary) / len(text) * 100) if text else 0:.1f}%",
                'rouge_1_precision': rouge_scores['rouge-1']['p'],
                'rouge_1_recall': rouge_scores['rouge-1']['r'],
                'rouge_1_f1': rouge_scores['rouge-1']['f'],
                'processing_time': f"{processing_time:.3f} seconds"
            },
            'success': True
        })

    except Exception as e:
        logger.error(f"Error in summarize: {str(e)}")
        return jsonify({'error': str(e), 'success': False}), 500

# --- AI ANALYSIS USING OLLAMA -----
@app.route('/analyzeText', methods=['POST'])
def analyze():
    start_time = time.time()

    data = request.json
    keyword = data.get('keyword', '').strip().lower() if 'keyword' in data else None
    filter_type = data.get('filter', 'all')
    sub_filter = data.get('subFilter', '')
    section_number = data.get('section_number', None)

    if not keyword and filter_type == 'all':
        return jsonify({'error': 'Provide either a keyword or a filter with subFilter', 'success': False}), 400
    if filter_type in ['subsection', 'paragraph'] and not section_number:
        return jsonify({'error': 'Section number required for subsection or paragraph search', 'success': False}), 400

    try:
        text, _ = perform_search(keyword, filter_type, sub_filter, section_number)
        
        if not text:
            return jsonify({'error': 'No content found for the search query', 'success': False}), 404

        prompt = f"""
        Please analyze this section of the Nigerian Constitution:
        {text}

        Provide your analysis in this format:
        1. Simple Explanation: [explain in plain language]
        2. Key Points: [list main points]
        3. Practical Implications: [what this means in practice]
        """

        response = requests.post(
            'http://localhost:11434/api/generate',
            json={
                "model": "llama2",
                "prompt": prompt,
                "stream": False
            },
            timeout=15
        )

        if response.status_code == 200:
            result = response.json()
            analysis = result.get('response', 'No response received')

            rouge = Rouge()
            rouge_scores = rouge.get_scores(analysis, text)[0]
            end_time = time.time()
            processing_time = end_time - start_time

            return jsonify({
                'analysis': analysis,
                'metrics': {
                    'original_length': len(text),
                    'analysis_length': len(analysis),
                    'rouge_1_precision': rouge_scores['rouge-1']['p'],
                    'rouge_1_recall': rouge_scores['rouge-1']['r'],
                    'rouge_1_f1': rouge_scores['rouge-1']['f'],
                },
                'processing_time': f"{processing_time:.3f} seconds",
                'success': True
            })
        else:
            logger.error(f"Ollama returned status code: {response.status_code}")
            return jsonify({'error': f"Ollama failed with status {response.status_code}", 'success': False}), 500

    except requests.exceptions.ConnectionError:
        logger.error("Cannot connect to Ollama")
        return jsonify({'error': 'Cannot connect to Ollama. Ensure it is running at localhost:11434.', 'success': False}), 503
    except Exception as e:
        logger.error(f"Error in analyze: {str(e)}")
        return jsonify({'error': str(e), 'success': False}), 500

# Home route
@app.route('/')
def home():
    return "Flask API is running! Use the frontend or API endpoints to interact."

if __name__ == '__main__':
    app.run(debug=True, port=5000)