# Yifeng Zheng: Personal site and portfolio

A static course portfolio for [DSC 106 Lab 1](https://dsc106.com/labs/lab01/), built with HTML, CSS, and browser-native JavaScript. No framework, npm package, or build step is required.

## Pages

- **Home**: introduction and a decorative data-inspired illustration.
- **Projects**: two clearly labeled fictional project concepts.
- **Resume**: a fictionalized resume using sections, articles, lists, links, and machine-readable dates.
- **Contact**: the lab's native HTML email form.

The resume uses the author's real name and university, University of California San Diego (UCSD). For privacy, other resume details, including dates, coursework, experience, and skills, are illustrative. The project concepts are examples, not completed projects. The GitHub profile also identifies the author.

## Preview locally

Open this folder in WebStorm, open `index.html`, and choose **View → Open in Browser → Chrome**. WebStorm supplies the local HTTP server.

Alternatively, run the following from this folder with an existing Python installation, then open http://127.0.0.1:8106/:

```sh
python -m http.server 8106 --bind 127.0.0.1
```

Press Ctrl+C to stop that server. Use an HTTP URL so the JavaScript module loads correctly.

## How it works

`style.css` contains shared styling and responsive layouts. Each HTML page includes its own navigation with relative site links. `global.js` adds an optional Automatic / Light / Dark theme switch and saves that choice in local storage; navigation and the contact form work independently of JavaScript.

The locally authored SVG in `images/data-illustration.svg` is decorative and does not represent a dataset.

The contact form uses the owner's chosen contact address, `mailto:arthurzheng776721647@gmail.com`, with `method="post"` and `enctype="text/plain"`. Submitting opens the visitor's configured email application with a draft. The visitor reviews and sends it from that application; this website does not send mail automatically. The prefilled sender, subject, and message are examples that visitors can replace.

## Publication

This folder can be published with GitHub Pages using the `main` branch and repository root. Pages needs no custom build configuration for this site. Source files were prepared with AI assistance and should be understood and reviewed as part of the course exercise.
