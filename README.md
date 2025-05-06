# GitHub Portfolio - Lukas200301.github.io

This repository contains the code for my personal GitHub portfolio website, which showcases my public repositories in an elegant, responsive design.

## Features

- **Dynamic Repository Display:** Automatically fetches and displays all my public GitHub repositories
- **Repository Details:** Shows repository name, description, primary language, star count, and last updated date
- **Responsive Design:** Works on all device sizes from mobile to desktop
- **GitHub Integration:** Uses GitHub API to keep the portfolio updated with my latest work
- **Light/Dark Theme:** Supports both light and dark themes with a toggle switcher
- **Detailed Guides:** Custom guides for select repositories with comprehensive documentation
- **Enhanced UI:** Modern design with hover effects, transitions, and visual indicators
- **Accessibility:** Designed with accessibility in mind

## How It Works

The site uses vanilla HTML, CSS, and JavaScript with no dependencies. It works as follows:

1. When loaded, the site makes an API call to GitHub to fetch repository data
2. The data is then dynamically rendered in repository cards
3. Each repository includes relevant information and a link to the actual GitHub repository
4. The site is fully static and hosted on GitHub Pages

## Technical Implementation

- **GitHub API:** Uses the GitHub REST API to fetch repository data
- **Language Detection:** Color-codes repository languages based on GitHub's language colors
- **Responsive Layout:** Adapts to different screen sizes using modern CSS techniques
- **Theme System:** Features both light and dark themes with automatic OS preference detection
- **Guide Pages:** Dedicated pages for repository documentation with navigation and anchors
- **CSS Variables:** Theme-switching uses CSS custom properties for seamless transitions
- **localStorage:** Remembers user's theme preference between visits

## Local Development

To run this site locally:

1. Clone the repository: `git clone https://github.com/Lukas200301/Lukas200301.github.io.git`
2. Navigate to the project directory: `cd Lukas200301.github.io`
3. Open `index.html` in your browser

No build process or dependencies are required.

## Deployment

This site is automatically deployed to GitHub Pages. Any changes pushed to the main branch will be reflected on the live site.

To set up GitHub Pages for your own repository:

1. Go to your repository on GitHub
2. Navigate to Settings > Pages
3. Select the branch you want to deploy (usually `main` or `master`)
4. Select the folder (usually `/ (root)`)
5. Click Save

Your site will be published at `https://Lukas200301.github.io/`.

## License

This project is available for personal use and modification. Feel free to fork it and make it your own!