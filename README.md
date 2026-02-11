# Zakat Guide & Calculator

A comprehensive web resource for understanding and calculating Zakat, based on *Simple Zakat Guide: Understand and Calculate Your Zakat* by **Joe Bradford** (3rd Edition, 2022, Origem Publishing).

**Live site:** https://zakat-calculator.sadikuolsi2001.workers.dev/

## Features

- **Educational Guide** — Covers foundational principles, Islamic financial ethics, terminology, asset types (cash, gold, stocks, crypto, NFTs, real estate), haram earnings, expenses, and the eight Quranic categories of Zakat recipients.
- **Interactive Calculator** — Step-by-step worksheets for listing assets, identifying impermissible earnings, deducting expenses, and computing your final Zakat obligation with Nisab verification.
- **Privacy-First** — All calculations happen locally in the browser. No data is sent anywhere. Saved to localStorage only.
- **Open Source** — MIT licensed. No secrets, no API keys, no backend required.

## Tech Stack

- [Astro](https://astro.build) — Static site framework
- [React](https://react.dev) — Interactive calculator component (Astro island)
- [Tailwind CSS](https://tailwindcss.com) — Utility-first styling
- Deploys to [Cloudflare Pages](https://pages.cloudflare.com) (or any static host)

## Getting Started

```bash
npm install
npm run dev       # Start development server
npm run build     # Build for production (outputs to dist/)
npm run preview   # Preview production build
```

## Deployment (Cloudflare Pages)

1. Connect your GitHub repo to Cloudflare Pages
2. Set build command: `npm run build`
3. Set output directory: `dist`

## Attribution

Content is adapted from and inspired by:

> **Simple Zakat Guide: Understand and Calculate Your Zakat**
> by Joe Bradford (3rd Edition, 2022)
> Published by Origem Publishing
> ISBN-13: 978-0-9965192-4-3

This website is an educational resource. Always consult a qualified Islamic scholar for rulings specific to your situation.

## License

MIT
