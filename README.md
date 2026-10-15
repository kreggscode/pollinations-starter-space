---
title: Pollinations Starter
emoji: 🌱
colorFrom: green
colorTo: yellow
sdk: static
pinned: false
license: mit
short_description: Duplicate for a Pollinations app with BYOP sign-in
---

# Pollinations Starter

Duplicate this Space and you get a working Pollinations app that your visitors
pay for with **their own Pollen**. No key of yours ever runs dry, and there is
no redirect URI to register, so a duplicate works the moment it is created.

[![Made with pollinations.ai](https://raw.githubusercontent.com/pollinations/pollinations/main/packages/ui/src/brand/badge-made-with.svg)](https://pollinations.ai/?ref=badge)

## Why this uses the device flow

Bring Your Own Pollen has three sign-in flows. Redirect flows need your Space's
exact URL registered on an App Key, so every duplicate would need its own
registration before it could work.

The **device flow** needs no redirect URI at all:

1. The browser asks for a device code.
2. The visitor opens `https://enter.pollinations.ai/device?user_code=XXXX`
   and authorises.
3. The browser polls for the key and receives a scoped, budget-limited `sk_`.

That is why this Space works unchanged at any `*.hf.space` URL, including one
somebody else created ten seconds ago.

## Make it yours

Everything worth editing is in `app.js`, marked with `EDIT ME`:

| Line marked | What it controls |
| --- | --- |
| `EDIT ME: models` | Which models the picker offers |
| `EDIT ME: defaults` | Default size, seed and budget |
| `EDIT ME: system prompt` | The tone of the text panel |
| `EDIT ME: branding` | The title and colour in `index.html` |

Replace the generator with whatever you had in mind: the sign-in and the Pollen
handling stay the same.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page structure and the two panels |
| `app.js` | Device-flow sign-in and the Pollinations calls |
| `style.css` | Layout |
