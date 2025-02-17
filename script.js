function searchConstitution() {
    const query = document.getElementById("searchBox").value;
    if (query.trim() === "") {
      alert("Please enter a keyword to search.");
      return;
    }
    
    // Simulating search result
    document.getElementById("originalText").innerText = `Search results for "${query}"...`;
  }
  
  function summarizeText() {
    const originalText = document.getElementById("originalText").innerText;
    if (!originalText || originalText.includes("Search results will appear here")) {
      alert("No content to summarize.");
      return;
    }
    
    // Simulating a summary (in a real scenario, this would involve NLP processing)
    document.getElementById("summaryText").innerText = "This is a summarized version of the content.";
  }