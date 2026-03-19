# PastPath

Currently an interactive front-end narrative project, PastPath presents the temporal and spatial trajectories of World War II figures in map form.

PastPath combines a geographic interface with a biographical timeline, allowing users to explore important historical figures, track their movements, and switch between event-based story mode and route overview mode.

This project was created for HackMIT.

## Repository Name

HackMITChina2026

## Project Overview

PastPath is a static front-end web application built around interactive maps and scrolling biographical narratives. Future updates will include multi-figure browsing based on a timeline, exploring the changing landscape and global order from the interwar period to the pre-Cold War era (1930-1950), allowing users to experience the intersection of different figures across time and space, providing a fun and in-depth learning platform for World War II history enthusiasts.

Users can:

- Browse a series of historical figures related to World War II

- Search and switch between figures

- Track each person's timeline through map events

- Scroll through story chapters using the map camera

- Open a route overview mode to see the full picture of a character's journey

- Manage overlapping map events using a pop-up selection interface

This project focuses on presenting biographical accounts as spatial history, transforming the flow of history into an explorable visual story.

## Features

- Map-based interactive biographical narrative

- Scrollable event navigation

- Character sidebar with browsing and switching support

- Search and tag-assisted discovery

- Route overview mode

- Overlapping event selection pop-up

- First entry login screen

- Story panel show/hide control

- Local browsing history for storing previously opened characters

## Technology Stack

- HTML

- CSS

- JavaScript

- [MapLibre GL JS](https://maplibre.org/) for map rendering

- [Scrollama](https://github.com/russellsamora/scrollama) for scrollable narrative

## Project Structure

```text
PastPath/
├── index.html              # Main application entry
├── helper.html             # Helper page
├── config.js               # Story configuration builder
├── css/
│   └── style.css           # Main styles
├── js/
│   └── app.js              # Main application logic
├── data/
│   ├── people.json         # General people data
│   ├── tags.json           # Tag definitions
│   └── people/
│       ├── index.json      # Person index used by fetch()
│       ├── chiang.json
│       ├── mao.json
│       ├── hitler.json
│       ├── rommel.json
│       ├── montgomery.json
│       ├── macarthur.json
│       ├── stalin.json
│       ├── zhukov.json
│       └── einstein.json
├── assets/                 # Portraits, cover images, and other media
└── LICENSE