document.addEventListener("DOMContentLoaded", async function () {
    const backendURL = 'http://localhost:5000';
    
    // Navigation pages
    const pages = ['index.html', 'access.html', 'about.html', 'contact.html'];
    let storedPage = localStorage.getItem('currentPage') || 'index.html';
    let currentIndex = pages.indexOf(storedPage);
    if (currentIndex === -1) currentIndex = 0;

    // Navigation functions
    function goBack() {
        if (currentIndex > 0) {
            currentIndex--;
            navigateToPage();
        }
    }

    function goForward() {
        if (currentIndex < pages.length - 1) {
            currentIndex++;
            navigateToPage();
        }
    }

    function navigateToPage() {
        localStorage.setItem('currentPage', pages[currentIndex]);
        window.location.href = pages[currentIndex];
    }

    function updateNavigation() {
        const currentPath = window.location.pathname.split('/').pop() || 'index.html';
        currentIndex = pages.indexOf(currentPath);
        if (currentIndex === -1) currentIndex = 0;

        localStorage.setItem('currentPage', currentPath);

        document.querySelectorAll('.nav-links a').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === currentPath) {
                link.classList.add('active');
            }
        });

        const backButton = document.querySelector('.back-button');
        const forwardButton = document.querySelector('.forward-button');
        if (backButton) backButton.disabled = currentIndex === 0;
        if (forwardButton) forwardButton.disabled = currentIndex === pages.length - 1;
    }

    // Event listeners for navigation
    document.querySelectorAll('.nav-links a').forEach((link, index) => {
        link.addEventListener('click', function (event) {
            event.preventDefault();
            currentIndex = index;
            navigateToPage();
        });
    });

    const backButton = document.querySelector('.back-button');
    const forwardButton = document.querySelector('.forward-button');
    if (backButton) backButton.addEventListener('click', goBack);
    if (forwardButton) forwardButton.addEventListener('click', goForward);

    updateNavigation();

    // Menu toggle
    window.toggleMenu = function () {
        document.querySelector(".nav-links")?.classList.toggle("active");
    };

    // Dropdown elements
    const chapterDropdown = document.getElementById("chapter");
    const partDropdown = document.getElementById("part");
    const sectionDropdown = document.getElementById("section");
    const subsectionDropdown = document.getElementById("subsection");
    const filterDropdown = document.getElementById("filterDropdown");
    const subFilterDropdown = document.getElementById("subFilterDropdown");
    const sectionNumberInput = document.getElementById("sectionNumber");
    const searchBox = document.getElementById("searchBox");

    // Utility to clear and disable dropdowns
    function clearDropdown(dropdown) {
        if (dropdown) {
            dropdown.innerHTML = `<option value="">Select ${dropdown.id.charAt(0).toUpperCase() + dropdown.id.slice(1)}</option>`;
            dropdown.disabled = true;
        }
    }

    // Fetch options from backend
    async function fetchOptions(level, parentId = '') {
        const endpoint = `/api/filters/${level}`;
        const queryParam = parentId ? `?parent_id=${parentId}` : '';
        const dropdown = document.getElementById(level);
        if (!dropdown) return;

        try {
            const response = await fetch(endpoint + queryParam);
            const data = await response.json();
            clearDropdown(dropdown);

            if (data.success && data.data.length > 0) {
                data.data.forEach(item => {
                    const option = document.createElement("option");
                    option.value = item;
                    option.textContent = item;
                    dropdown.appendChild(option);
                });
                dropdown.disabled = false;
            }

            // Clear dependent dropdowns
            const dependentLevels = ['part', 'section', 'subsection'];
            dependentLevels.slice(dependentLevels.indexOf(level) + 1).forEach(clearDropdown);
        } catch (error) {
            console.error(`Error loading ${level} options:`, error);
            alert(`Failed to load ${level} options. Is the backend running?`);
        }
    }

    // Fetch subFilter options based on filter type
    async function updateSubFilter() {
        const filterType = filterDropdown.value;
        clearDropdown(subFilterDropdown);
        sectionNumberInput.style.display = (filterType === 'subsection' || filterType === 'paragraph') ? 'block' : 'none';

        if (filterType === 'all') {
            subFilterDropdown.disabled = true;
            return;
        }

        try {
            const response = await fetch(`/api/filters/${filterType}`);
            const data = await response.json();
            if (data.success && data.data.length > 0) {
                data.data.forEach(item => {
                    const option = document.createElement("option");
                    option.value = item;
                    option.textContent = item;
                    subFilterDropdown.appendChild(option);
                });
                subFilterDropdown.disabled = false;
            }
        } catch (error) {
            console.error(`Error loading ${filterType} options:`, error);
        }
    }

    // Initial setup
    fetchOptions('chapter');
    if (filterDropdown) filterDropdown.addEventListener("change", updateSubFilter);
    if (chapterDropdown) chapterDropdown.addEventListener("change", () => fetchOptions('part', chapterDropdown.value));
    if (partDropdown) partDropdown.addEventListener("change", () => fetchOptions('section', partDropdown.value));
    if (sectionDropdown) sectionDropdown.addEventListener("change", () => fetchOptions('subsection', sectionDropdown.value));
    if (subsectionDropdown) subsectionDropdown.addEventListener("change", autoFillSearch);

    // Auto-fill search form from hierarchical dropdowns
    function autoFillSearch() {
        const chapter = chapterDropdown.value;
        const part = partDropdown.value;
        const section = sectionDropdown.value;
        const subsection = subsectionDropdown.value;

        if (subsection) {
            filterDropdown.value = 'subsection';
            subFilterDropdown.value = subsection;
            sectionNumberInput.value = section;
            sectionNumberInput.style.display = 'block';
        } else if (section) {
            filterDropdown.value = 'section';
            subFilterDropdown.value = section;
            sectionNumberInput.value = '';
            sectionNumberInput.style.display = 'none';
        } else if (part) {
            filterDropdown.value = 'part';
            subFilterDropdown.value = part;
        } else if (chapter) {
            filterDropdown.value = 'chapter';
            subFilterDropdown.value = chapter;
        }
        updateSubFilter();
    }

    // Search function
    async function searchConstitution() {
        const keyword = searchBox?.value || '';
        const filter = filterDropdown?.value || 'all';
        const subFilter = subFilterDropdown?.value || '';
        const sectionNumber = sectionNumberInput?.value || '';

        const payload = {};
        if (keyword) payload.keyword = keyword;
        if (filter !== 'all') {
            payload.filter = filter;
            payload.subFilter = subFilter;
            if ((filter === 'subsection' || filter === 'paragraph') && !sectionNumber) {
                alert('Section number is required for this filter.');
                return;
            }
            if (sectionNumber) payload.section_number = sectionNumber;
        }

        const loadingSpinner = document.getElementById("loadingSpinner");
        const searchText = document.getElementById("searchText");
        loadingSpinner?.classList.remove("d-none");
        searchText?.classList.add("d-none");

        try {
            const response = await fetch("http://localhost:5000/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await response.json();

            loadingSpinner?.classList.add("d-none");
            searchText?.classList.remove("d-none");

            const resultBox = document.getElementById("inputText1");
            if (data.success) {
                resultBox.value = data.results.map(item => item.content).join('\n\n') || "No results found.";
            } else {
                resultBox.value = `Error: ${data.error}`;
            }
        } catch (error) {
            console.error("Search Error:", error);
            alert("Failed to search. Is the backend running?");
            loadingSpinner?.classList.add("d-none");
            searchText?.classList.remove("d-none");
        }
    }

    // Generate summary
    async function generateSummary() {
        const filter = filterDropdown?.value || 'all';
        const subFilter = subFilterDropdown?.value || '';
        const sectionNumber = sectionNumberInput?.value || '';
        const inputText = document.getElementById("inputText1")?.value;

        if (!inputText) {
            alert("Please search for some text first.");
            return;
        }

        const payload = { filter, subFilter };
        if (filter === 'subsection' || filter === 'paragraph') {
            if (!sectionNumber) {
                alert('Section number is required for this filter.');
                return;
            }
            payload.section_number = sectionNumber;
        }

        try {
            const response = await fetch("http://localhost:5000/summarize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await response.json();

            if (data.success) {
                document.getElementById("summaryText").value = data.summary || "No summary generated.";
            } else {
                alert(`Error: ${data.error}`);
            }
        } catch (error) {
            console.error("Summary Error:", error);
            alert("Failed to summarize. Is the backend running?");
        }
    }

    // Analyze text
    async function analyzeText() {
        const filter = filterDropdown?.value || 'all';
        const subFilter = subFilterDropdown?.value || '';
        const sectionNumber = sectionNumberInput?.value || '';
        const inputText = document.getElementById("inputText1")?.value;

        if (!inputText) {
            alert("Please search for some text first.");
            return;
        }

        const payload = { filter, subFilter };
        if (filter === 'subsection' || filter === 'paragraph') {
            if (!sectionNumber) {
                alert('Section number is required for this filter.');
                return;
            }
            payload.section_number = sectionNumber;
        }

        try {
            const response = await fetch("http://localhost:5000/analyzeText", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await response.json();

            if (data.success) {
                document.getElementById("analysisText").value = data.analysis || "No analysis generated.";
            } else {
                alert(`Error: ${data.error}`);
            }
        } catch (error) {
            console.error("Analysis Error:", error);
            alert("Failed to analyze. Is Ollama running?");
        }
    }

    // Expose functions to global scope for HTML onclick
    window.goBack = goBack;
    window.goForward = goForward;
    window.generateSummary = generateSummary;
    window.analyzeText = analyzeText;

    // Event listeners
    if (searchBox) {
        searchBox.addEventListener("keyup", event => {
            if (event.key === "Enter") searchConstitution();
        });
    }
});