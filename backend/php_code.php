<?php
// Database connection settings remain the same
$servername = "localhost";  
$username = "root";         
$password = "";             
$dbname = "nigerian_constitution"; 

// Create a new MySQL connection
$conn = new mysqli($servername, $username, $password, $dbname);

// Check the database connection
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

// Load JSON file
$jsonFile = 'constitution.json'; 
$jsonData = file_get_contents($jsonFile);
$data = json_decode($jsonData, true);

if (!$data) {
    die("Failed to load JSON file.");
}

// Insert into `chapter` table
foreach ($data['chapters'] as $chapter) {
    $chapter_title = $chapter['CHAPTER_TITLE'];

    $stmt = $conn->prepare("INSERT INTO chapter (chapter_title) VALUES (?)");
    $stmt->bind_param("s", $chapter_title);
    
    if (!$stmt->execute()) {
        die("Chapter Insert Error: " . $stmt->error);
    }
    $chapter_id = $stmt->insert_id;
    echo "Inserted chapter ID: $chapter_id <br>";

    // Insert into `part` table
    if (isset($chapter['PART']) && is_array($chapter['PART'])) {
        foreach ($chapter['PART'] as $part) {
            $part_title = $part['PART_TITLE'];

            $stmt = $conn->prepare("INSERT INTO part (part_title, chapter_id) VALUES (?, ?)");
            $stmt->bind_param("si", $part_title, $chapter_id);
            
            if (!$stmt->execute()) {
                die("Part Insert Error: " . $stmt->error);
            }
            $part_id = $stmt->insert_id;
            echo "Inserted part ID: $part_id <br>";

            // Insert into `section` table
            if (isset($part['sections']) && is_array($part['sections'])) {
                foreach ($part['sections'] as $section) {
                    $section_number = isset($section['section_number']) ? $section['section_number'] : 0;
                    $section_title = isset($section['section_title']) ? $section['section_title'] : "";
                    $section_content = isset($section['content']) 
                        ? (is_array($section['content']) ? implode(" ", $section['content']) : $section['content']) 
                        : "";

                    $stmt = $conn->prepare("INSERT INTO section (section_number, section_title, content, part_id) VALUES (?, ?, ?, ?)");
                    $stmt->bind_param("issi", $section_number, $section_title, $section_content, $part_id);
                    
                    if (!$stmt->execute()) {
                        die("Section Insert Error: " . $stmt->error);
                    }
                    $section_id = $stmt->insert_id;
                    echo "Inserted section ID: $section_id <br>";

                    // Insert into `subsection` table
                    if (isset($section['subsections']) && is_array($section['subsections'])) {
                        echo "Processing subsections for Section ID: $section_id <br>";
                        
                        foreach ($section['subsections'] as $subsection) {
                            if (isset($subsection['subsection_number']) && isset($subsection['content'])) {
                                $subsection_number = $subsection['subsection_number'];
                                $subsection_content = $subsection['content']; 

                                echo "Inserting subsection: $subsection_number <br>";
                                echo "Content: $subsection_content <br>";

                                $stmt = $conn->prepare("INSERT INTO subsection (subsection_number, content, section_id) VALUES (?, ?, ?)");
                                $stmt->bind_param("ssi", $subsection_number, $subsection_content, $section_id);
                                
                                if (!$stmt->execute()) {
                                    die("Subsection Insert Error: " . $stmt->error);
                                }
                                $subsection_id = $stmt->insert_id;
                                echo "Inserted subsection ID: $subsection_id <br>";

                                // Insert paragraphs if they exist
                                if (isset($subsection['paragraphs']) && is_array($subsection['paragraphs'])) {
                                    foreach ($subsection['paragraphs'] as $paragraph) {
                                        if (isset($paragraph['paragraph_alphabet']) && isset($paragraph['content'])) {
                                            $paragraph_number = $paragraph['paragraph_alphabet'];
                                            $paragraph_content = $paragraph['content'];

                                            echo "Inserting paragraph: $paragraph_number <br>";
                                            echo "Content: $paragraph_content <br>";

                                            $stmt = $conn->prepare("INSERT INTO paragraph (paragraph_number, content, subsection_id) VALUES (?, ?, ?)");
                                            $stmt->bind_param("ssi", $paragraph_number, $paragraph_content, $subsection_id);
                                            
                                            if (!$stmt->execute()) {
                                                die("Paragraph Insert Error: " . $stmt->error);
                                            }
                                            echo "Inserted paragraph successfully <br>";
                                        }
                                    }
                                }
                            }
                        }
                    } else {
                        echo "No subsections found for Section ID: $section_id <br>";
                    }
                }
            }
        }
    }
}

// Close the database connection
$conn->close();

echo "All data inserted successfully!";
?>