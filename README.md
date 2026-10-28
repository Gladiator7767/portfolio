# Yifeng Zheng: Personal site and portfolio

A course portfolio for [DSC 106 Lab 1](https://dsc106.com/labs/lab01/), [Lab 2](https://dsc106.com/labs/lab02/), [Lab 3](https://dsc106.com/labs/lab03/), [Lab 4](https://dsc106.com/labs/lab04/), and [Lab 5](https://dsc106.com/labs/lab05/), built with HTML, CSS, and browser-native JavaScript. Lab 5 imports D3 7.9.0 from jsDelivr. No framework, local npm package, or build step is required.

## Pages

- **Home**: introduction, live public GitHub stats, and the first three projects from the shared JSON file.
- **Projects**: an automatically counted list of coursework and twelve clearly labeled fictional concepts, with a D3 pie chart of projects by year. Search across metadata and select a year using a slice or legend button. Both filters work together in either order. All entries have a title, decorative image, description, and year.
- **Resume**: a fictionalized resume using sections, articles, lists, links, and machine-readable dates.
- **Contact**: an email draft form with JavaScript encoding for the subject and message.

The resume uses the author's real name and university, University of California San Diego (UCSD). For privacy, other resume details, including dates, coursework, experience, and skills, are illustrative. Fictional project concepts and their sample years are explicitly labeled. Coursework is listed separately, and the ongoing poverty project is marked in progress. The GitHub profile also identifies the author.

## Preview locally

Open this folder in WebStorm, open `index.html`, and choose **View → Open in Browser → Chrome**. WebStorm supplies the local HTTP server.

Alternatively, run the following from this folder with an existing Python installation, then open http://127.0.0.1:8106/:

```sh
python -m http.server 8106 --bind 127.0.0.1
```

Press Ctrl+C to stop that server. Use an HTTP URL so the JavaScript module loads correctly.

## How it works

`style.css` contains shared styling and responsive layouts. Every page loads `global.js` as an ES module. The module generates one shared navigation menu from a page array, marks the current page, and opens the external GitHub link in a new tab. Internal URLs resolve relative to the module, so the same code works at a local server root, WebStorm's project path, or GitHub Pages' repository path. Both directory URLs and explicit `index.html` URLs identify the current page.

JavaScript also creates an Automatic / Light / Dark switch at the top right. The CSS `color-scheme` follows the OS in Automatic mode. A shared function updates the page and selected option, and the `colorScheme` preference is restored from local storage across refreshes and navigation. If storage is unavailable, switching the current page still works. Borders and hover backgrounds adapt to both themes.

Lab 2 connects the CSS ideas from class to four layouts:

- **Page and navigation**: a centered, padded body with a relative maximum width; Flexbox links with a stable current-page and hover border.
- **Projects**: `auto-fill` and `minmax()` adjust the column count. Every article spans three parent rows and uses row subgrid to align its heading, image, and paragraph with neighboring cards.
- **Contact**: a two-column Grid form whose labels share columns through subgrid. Controls inherit the page font; the button spans the whole form.
- **Resume**: aligned section headings and content, with smaller muted dates and consistent list spacing. At narrow widths, the resume and contact form stack vertically.

All four locally authored SVGs in `images/` are decorative illustrations and do not represent measured datasets. Project images use empty alt text because the adjacent heading and description carry the content.

Lab 4 separates the project data into `lib/projects.json`. Keep the newest coursework first: the homepage uses `slice(0, 3)` rather than sorting by year. `global.js` exports `fetchJSON`, `renderProjects`, and `fetchGitHubData`. The homepage's `index.js` and the Projects page's `projects.js` reuse those functions. Image and link paths in the JSON are relative to the site root; the renderer resolves them from `global.js`, so they also work on nested routes and GitHub Pages. Every article still spans three subgrid rows: heading, image, and details. Project years and status are inside the details row.

The GitHub panel reads the public `Gladiator7767` profile without a token. Counts are fetched on load and when **Refresh stats** is pressed. Unavailable data displays an error message rather than invented counts; local project loading runs separately. The Projects title uses the JSON array length and never reports zero merely because a fetch failed. API counts may change over time. The lab's following/followers activity must be completed with classmates; the site does not follow accounts or manufacture followers.

Use a current browser with CSS subgrid and `light-dark()` support, such as the Chrome version used in class. Resize the browser window to see the layout change; zooming is a different action.

The optional Lab 3 contact improvement uses the owner's chosen contact address, `mailto:arthurzheng776721647@gmail.com`. Its JavaScript submit handler reads `FormData`, encodes each subject/message field using `encodeURIComponent()`, and opens the resulting draft URL. The redundant sender field has been removed, since the visitor sends from their own mail application. The visitor reviews and sends the draft there; this website does not send mail automatically. The prefilled subject and message are examples that visitors can replace.

The HTML form retains a native GET fallback if JavaScript is disabled, though clients may interpret its spaces differently. The shared navigation and theme control are JavaScript-generated as required by Lab 3; enable JavaScript to use them.

## Publication

Scripts and styles use the shared `?v=5` release suffix so a browser with cached Lab 4 files loads the Lab 5 modules together. Keep the HTML script URLs and module imports consistent when changing this suffix in a later release.

The Projects chart uses D3 `rollups`, `pie`, `arc`, and an ordinal color scale. Its counts summarize the current search results. The selected year additionally filters the cards, while other matching years remain available for switching. The status text distinguishes visible cards from search matches. Year identity and colors remain stable when a query removes a category; selected slices and legend buttons stay synchronized. Keyboard users can activate slices with Enter or Space and use the native legend buttons. Clearing filters restores the full dataset, including after an empty result.

This folder can be published with GitHub Pages using the `main` branch and repository root. Pages needs no custom build configuration for this site. Source files were prepared with AI assistance and should be understood and reviewed as part of the course exercise.
