---
title: "Pixel Pandemonium"
excerpt: "A collaborative, classroom-scale pixel-art activity: a teacher launches an instance from any image, students submit colored pixels into a shared grid from their own devices, and the artwork rebuilds live on a projected replay — a hands-on way to teach how digital images are encoded, one pixel at a time."
collection: software
comments: true
tags:
  - education
  - cs education
  - visualization
  - pixel graphics
  - web
  - javascript
  - realtime
---

Pixel Pandemonium is the digital companion to a long-running "unplugged" computer science outreach activity. In the unplugged version, participants fill in grids by hand to recreate images and animations, building intuition for how digital graphics, encoding, and algorithms work. This software brings that same idea online: a teacher creates an *instance* from a picture, students join from their own phones or laptops and submit individual colored pixels into a shared grid, and everyone watches the image reassemble in real time. It is designed for classrooms, science-festival booths, and large-group demonstrations where dozens of people contribute to a single emerging picture at once.

**You can try it live here: [Pixel Pandemonium](https://www.billmongan.com/PixelPandemonium_Client).**

A typical session runs like this: the teacher opens the create-instance page and builds a picture — either from a set of predefined images, from a custom image or GIF they upload (the client downsamples it to the tile-grid dimensions without distorting the aspect ratio and extracts a working color palette), or from a posterizer-style spec. The teacher then shares a join code (and a QR code) with students. On the student page, each participant is assigned tiles to complete, selects colors from the palette, and submits pixels; the interface visualizes each tile's state — blank, in progress, complete, or in error (for example, an amber highlight for a wrong color). Meanwhile, the teacher's replay view animates the picture rebuilding in submission order, with controls for sequential or random playback and speed. A public Tetris demo is always available with no key required, so anyone can see how it works.

The client is a static front end (Jekyll/HTML/CSS/vanilla JavaScript) that can be deployed to GitHub Pages or any static host, which keeps it easy to run for a single class or a whole event. All picture data, instance state, and live updates come from a companion back-end service it talks to over a REST API and a WebSocket realtime channel.

[PixelPandemonium Client (source on GitHub)](https://github.com/BillJr99/PixelPandemonium_Client)

## Architecture

Pixel Pandemonium is a two-part system: this public client and a companion server (a separate, private project). The client holds no game logic of its own — it is a thin, deployable front end that renders the grid, captures pixel submissions, and subscribes to live updates. Everything stateful lives on the server.

The server is a Node.js application that exposes a REST API for the instance lifecycle (creating an instance, validating a join code, submitting pixels, retrieving the full set of submissions for replay, and administrative reset/inspection) and serves the picture catalog and custom-picture uploads. Submitted pixels are persisted in a lightweight SQLite database so that an instance can be replayed at any time, even after a break. Realtime updates are delivered through a publish/subscribe channel — one channel per instance — so that as each student submits a pixel, every connected viewer sees it appear without polling. The same server can be deployed either as a traditional long-running Node service or as a serverless Cloudflare Worker backed by a managed database, which makes it inexpensive to host for a one-off event.

Access is organized in layers so the right people see the right things: students interact with an instance through a per-instance join code, teachers manage their own instances through a teacher view, and administrative operations sit behind a separate administrative path. The server also applies routine safeguards such as request rate limiting and input validation. (No keys, passwords, or other configuration secrets are described here — those live only in the server's private deployment configuration.)

This separation — a static, swappable client over a small stateful service with realtime fan-out — is what lets a single picture be built collaboratively by a large, distributed group in real time while keeping the deployment footprint small.
