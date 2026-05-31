# Vikretha — Project Context

## Overview

**Vikretha** is a zero-cost, self-hosted shop management progressive web app (PWA) for small, independent shop owners (kiranas, boutiques, street vendors). It runs as a static site on GitHub Pages with Firebase Firestore as the backend and Firebase Auth (Phone OTP) for access control.

## Problem

Small shop owners need affordable inventory/sales tracking without SaaS subscriptions, internet infrastructure, or complex tools. Most rely on paper registers or WhatsApp — losing data, gaining no insights, and lacking professional receipts.

## Solution

Sellers fork the template repository, configure their Firebase project credentials in `shop.config.js`, and immediately get a branded shop management tool — no subscription, no custom server, no vendor lock-in.

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Backend | Firebase Firestore (Spark free) | 20K writes/day, built-in offline, real-time sync, ACID transactions |
| Auth | Firebase Phone OTP | Indian users know OTP; proper per-user auth |
| Hosting | GitHub Pages | Zero-cost, HTTPS, CDN, no server |
| Frontend | Vanilla JS (ES Modules) | No build step, fork-and-go simplicity |
| Offline | Firestore SDK persistence | Automatic IndexedDB cache + write queue |
| Routing | Hash-based (`/#/route`) | Works on GitHub Pages without 404 hacks |
| Receipts | Canvas 2D API | 0KB dependency, fast, reliable |
| Export | SheetJS (xlsx) via CDN | Client-side Excel, lazy-loaded |
| Styling | Tailwind CSS CDN or minimal custom CSS | Mobile-first, responsive |

## Success Metrics

| KPI | Target |
|-----|--------|
| Phone OTP login — authorized access only | Day 1 |
| Daily/weekly/monthly sales dashboard | Day 1 |
| Receipt image shareable via WhatsApp | < 1 sec generation |
| Setup time for new shop owner | < 30 minutes |
| Cost to run | ₹0 forever |
| Mobile feature parity | Full |
| Offline billing | Day 1 |
| Excel export | Day 1 |
| App JS payload (excl. Firebase SDK) | < 30 KB |

## Technology Stack

| Layer | Choice |
|-------|--------|
| Hosting | GitHub Pages |
| Frontend | Vanilla JS ES Modules |
| Styling | Tailwind CSS CDN / custom CSS |
| Database | Firebase Firestore (Spark free) |
| Auth | Firebase Auth (Phone OTP) |
| Offline | Firestore SDK IndexedDB persistence |
| Receipts | Canvas 2D API |
| Charts | CSS flexbox bar chart |
| Export | SheetJS (xlsx) CDN |
| WhatsApp | `wa.me` deep link + Web Share API |
| PWA | Service Worker + manifest.json |
| Routing | Hash-based |

## User Personas

1. **Shop Owner / Admin** — Low-to-medium tech comfort. Wants insights, stock tracking, professional bills, Excel export. Primarily uses Android smartphone.
2. **Salesperson / Counter Staff** — Low tech comfort. Needs dead-simple, instant UI for recording sales and sharing receipts.

## Non-Goals (MVP)

- Role-based permissions beyond authorized phone numbers
- Multi-branch / multi-location support
- Payment gateway integration
- Native iOS/Android app
- Custom domain setup
- Barcode scanner
- GST/tax calculation
- PDF export

## Reference Documents

- [PRD](../docs/prd/vikretha-prd.md) — Product Requirements Document v3.0
- [TRD](../docs/trd/vikretha-trd.md) — Technical Requirements Document v3.0
