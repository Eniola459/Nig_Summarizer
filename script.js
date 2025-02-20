// Wait for the DOM to fully load before executing the script
document.addEventListener("DOMContentLoaded", function () {
    // Define navigation functions globally
    let pages = ['index.html', 'Access.html', 'about.html', 'contact.html'];
    let currentIndex = 0;

    function goBack() {
        if (currentIndex > 0) {
            currentIndex--;
            window.location.href = pages[currentIndex]; // Navigate to the previous page
        }
    }

    function goForward() {
        if (currentIndex < pages.length - 1) {
            currentIndex++;
            window.location.href = pages[currentIndex]; // Navigate to the next page
        }
    }

    // Attach the functions globally so that the HTML can access them
    window.goBack = goBack;
    window.goForward = goForward;

    // Add event listeners to buttons in HTML
    document.querySelector('.back-button').addEventListener('click', goBack);
    document.querySelector('.forward-button').addEventListener('click', goForward);

    // Navigation links
    const navLinks = document.querySelectorAll('.nav-links a');

    // Section elements
    const sections = document.querySelectorAll("section");

    // Hide all sections initially
    sections.forEach(section => section.style.display = 'none');

    // Show home section by default
    const homeSection = document.getElementById('home');
    if (homeSection) homeSection.style.display = 'block';

    // Navigation handling
    navLinks.forEach(function (link) {
        link.addEventListener('click', function (event) {
            const targetId = link.getAttribute('href').substring(1);
            const targetSection = document.getElementById(targetId);

            if (targetSection) {
                event.preventDefault();
                sections.forEach(sec => sec.style.display = 'none');
                targetSection.style.display = 'block';
            }
        });
    });

    // Toggle menu function
    function toggleMenu() {
        document.querySelector(".nav-links").classList.toggle("show");
    }
    window.toggleMenu = toggleMenu;

    // Filter function
    function filterDocuments() {
        const yearFilter = document.getElementById('year-filter');
        const typeFilter = document.getElementById('type-filter');
        const docItems = document.querySelectorAll('.doc-item');

        const selectedYear = yearFilter ? yearFilter.value : 'all';
        const selectedType = typeFilter ? typeFilter.value : 'all';

        docItems.forEach(function (docItem) {
            const docYear = docItem.getAttribute('data-year');
            const docType = docItem.getAttribute('data-type');

            const isYearMatch = (selectedYear === 'all' || docYear === selectedYear);
            const isTypeMatch = (selectedType === 'all' || docType === selectedType);

            docItem.style.display = isYearMatch && isTypeMatch ? 'block' : 'none';
        });
    }

    // Add event listeners for filters
    const yearFilter = document.getElementById('year-filter');
    const typeFilter = document.getElementById('type-filter');
    const filterDropdown = document.getElementById("filterDropdown");
    const subFilterDropdown = document.getElementById("subFilterDropdown");
    const searchBox = document.getElementById("searchBox");

    if (yearFilter) yearFilter.addEventListener('change', filterDocuments);
    if (typeFilter) typeFilter.addEventListener('change', filterDocuments);
    if (filterDropdown) filterDropdown.addEventListener("change", loadSubFilters);
    if (searchBox) {
        searchBox.addEventListener("keyup", function (event) {
            if (event.key === "Enter") {
                searchConstitution();
            }
        });
    }

    // Load subcategories dynamically
    async function loadSubFilters() {
        if (!subFilterDropdown) return;
        subFilterDropdown.innerHTML = '<option value="">Select category...</option>';
        let filterType = filterDropdown.value;
        if (filterType === "all") return;

        try {
            const response = await fetch(`/getSubFilters?filter=${filterType}`);
            const data = await response.json();
            data.forEach(item => {
                let newOption = document.createElement("option");
                newOption.text = item.name;
                newOption.value = item.id;
                subFilterDropdown.appendChild(newOption);
            });
        } catch (error) {
            console.error("Error loading subfilters:", error);
        }
    }

    // Perform search
    async function searchConstitution() {
        let keyword = searchBox ? searchBox.value : "";
        let filter = filterDropdown ? filterDropdown.value : "";
        let subFilter = subFilterDropdown ? subFilterDropdown.value : "";

        try {
            const response = await fetch("/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ keyword, filter, subFilter })
            });

            const data = await response.json();
            document.getElementById("inputText1").value = data.results || "No results found.";
        } catch (error) {
            console.error("Search Error:", error);
        }
    }

    // Generate summary
    function generateSummary() {
        let text = document.getElementById("inputText1").value;
        document.getElementById("summaryText").value = text
            ? "Summarized: " + text.substring(0, 100) + "..."
            : "No text available for summarization.";
    }

    // Analyze text with AI
    async function analyzeText() {
        let text = document.getElementById("inputText1").value;
        if (!text.trim()) {
            alert("Please enter some text to analyze.");
            return;
        }

        try {
            const response = await fetch("/analyzeText", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text })
            });

            const data = await response.json();
            document.getElementById("analysisText").value = data.explanation || "Could not generate analysis.";
        } catch (error) {
            console.error("Analysis Error:", error);
        }
    }

    // Expose functions globally
    window.generateSummary = generateSummary;
    window.analyzeText = analyzeText;
});
