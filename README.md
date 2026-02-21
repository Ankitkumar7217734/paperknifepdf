<p align="center">
  <img src="public/icons/logo-github.svg" width="120" alt="PaperKnife Logo">
</p>

# PaperKnife

**A simple, honest PDF & Image utility that respects your privacy.**

[![License](https://img.shields.io/badge/license-AGPL--3.0-rose.svg)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/Ankitkumar7217734/paperknifepdf?style=flat&color=rose)](https://github.com/Ankitkumar7217734/paperknifepdf/stargazers)

---

## Preview

<p align="center">
  <img src="assets/preview/screenshot1.jpg" width="45%" alt="Web View">
  <img src="assets/preview/screenshot2.jpg" width="45%" alt="Android View">
</p>

---

### Why this was built

Most PDF websites ask you to upload your sensitive documents—bank statements, IDs, contracts—to their servers. Even if they promise to delete them, your data still leaves your device and travels across the internet.

**PaperKnife** solves this. It's a collection of tools that run entirely in your browser or on your phone. Your files never leave your memory, they aren't stored in any database, and no server ever sees them. It works 100% offline.

### What it can do

- **Modify:** Merge multiple files, split pages, rotate, and rearrange.
- **Optimize:** Reduce file size of PDFs and Images with different quality presets.
- **Secure:** Encrypt files with passwords or remove them locally.
- **Convert:** Convert between PDF and images (JPG/PNG/WEBP) or plain text.
- **Sign:** Add an electronic signature to your documents safely.
- **Sanitize:** Deep clean metadata (like Author or Producer) to keep your files anonymous.

### How to use it

- **On Android:** Clone the repository and build the APK using Capacitor, or use the web version.
- **On the Web:** Once hosted, you can use it like any other website, or "install" it as a PWA for offline access.

---

### Under the hood

PaperKnife is built with **React** and **TypeScript**. The core processing is handled by **pdf-lib** and **pdfjs-dist**, which run in a sandboxed environment using WebAssembly. The Android version is powered by **Capacitor**.

This project is licensed under the **GNU AGPL v3** to ensure it remains open and transparent forever.

---

_Made with care by [Ankitkumar7217734](https://github.com/Ankitkumar7217734)_
