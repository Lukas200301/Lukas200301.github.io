document.addEventListener("DOMContentLoaded", function() {
    const dots = document.querySelectorAll(".dot");

    function adjustForScreenSize() {
        const width = window.innerWidth;
        let animationDuration = 1.5;
        if (width < 600) {
            animationDuration = 1;
        } else if (width > 1000) {
            animationDuration = 2;
        }

        dots.forEach(dot => {
            dot.style.animationDuration = `${animationDuration}s`;
        });
    }

    async function fetchRepos() {
        const repoList = document.getElementById("repo-list");
        const githubApiUrl = "https://api.github.com/users/Lukas200301/repos";
        try {
            const response = await fetch(githubApiUrl);
            const repos = await response.json();

            repos.forEach(repo => {
                if (repo.name === "Gifs-Images" || repo.name === "Lukas200301.github.io") {
                    return;
                }

                const repoItem = document.createElement("div");
                repoItem.classList.add("repo-item");

                const description = repo.description ? repo.description.slice(0, 100) + (repo.description.length > 100 ? "..." : "") : "No description available.";

                repoItem.innerHTML = `
                    <a href="${repo.html_url}" target="_blank">${repo.name}</a>
                    <p>${description}</p>
                `;

                repoList.appendChild(repoItem);
            });
        } catch (error) {
            console.error("Error fetching repositories:", error);
        }
    }

    adjustForScreenSize();
    fetchRepos();
    window.addEventListener("resize", adjustForScreenSize);
});
