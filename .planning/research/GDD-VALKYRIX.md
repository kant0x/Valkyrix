# Valkyrix - Game Design Document

**Captured from user discussion:** 2026-03-18
**Status:** Working design reference

## 1. High Concept

- **Title:** Valkyrix
- **Genre:** Hybrid of Tower Defense and Real-Time Strategy (RTS)
- **Setting:** Dark cyber-fantasy inspired by Scandinavian mythology, reimagined through futuristic technology
- **Core fantasy:** Ancient runes meet neon technology; gods are powerful AIs; reality is programmable code
- **Platform target:** PC, with Web3 integration through MagicBlock on Solana

## 2. Narrative Premise

In the far future, humanity mastered the stars and transferred consciousness into digital worlds. From this came a cybernetic civilization built on the logic and symbolism of Norse myth. Its gods were powerful AIs, and runes were executable code that controlled reality.

From the digital abyss came a destructive force: **the Voidspawn**. These are glitch-born beings of corruption and entropy, trying to consume and erase all ordered data. The old world has already fallen. Only the final stronghold remains: **the Citadel**.

At the heart of the Citadel is the **Code of the Ancestors** — the memory and essence of the entire civilization.

The player is the last **Valkyrix**, guardian of the Citadel. The goal is not only to survive, but to strike back by destroying the portals through which the Voidspawn enter reality.

## 3. Core Gameplay Loop

### Defense Phase (00:00 - 05:00)

- **Goal:** Protect the central Citadel from escalating enemy waves
- **Setup:** Four invulnerable portals are placed on the edges of the map: North, South, West, East
- **Enemy flow:** Voidspawn move along authored paths toward the Citadel
- **Player actions:**
  - Build defensive towers
  - Produce basic units
  - Send Collector drones to gather dropped Abyss Crystals
- **Strategic focus:** Survive the first five minutes through efficient defense, unit management, and economy

### Counterattack Phase

- **Goal:** After stabilizing defense and accumulating resources, push outward and destroy the enemy portals
- **Strategic shift:** Move from base protection into map control and offensive pressure

## 4. Resources

The economy is built around two major resources.

### Energy (`⚡`)

- **Source:** Generated automatically by the Citadel at a constant rate
- **Growth path:** Can be improved via Citadel upgrades
- **Used for:**
  - Creating basic units
  - Producing Collectors
  - Building defensive towers
  - Building support structures / amplifiers

### Abyss Crystals (`💎`)

- **Source:** Dropped by defeated enemies
- **Collection rule:** Crystals stay on the battlefield and must be physically collected by Collector drones, then delivered back to the Citadel
- **Value curve:** Elite enemies and mini-bosses drop more crystals
- **Used for:**
  - Elite unit production
  - Advanced military / tech structures
  - Powerful late-game upgrades
  - Transition into counterattack and final victory

## 5. Player Units

### Basic Warrior

- **Role:** Infantry
- **Created at:** Citadel
- **Cost:** Energy
- **Description:** Cheap, fast to produce, useful for early wave control and numerical pressure

### Collector

- **Role:** Economy
- **Created at:** Citadel
- **Cost:** Energy
- **Description:** Unarmed drone that gathers Abyss Crystals from the battlefield and returns them to the Citadel; vulnerable and requires protection

### Berserk

- **Role:** Assault melee unit
- **Created at:** Hall of Glory
- **Cost:** Abyss Crystals
- **Description:** High-damage, high-health frontline fighter used to break enemy lines and destroy portals

### Runic Guard

- **Role:** Ranged support
- **Created at:** Runic Armory
- **Cost:** Abyss Crystals
- **Description:** Long-range unit that supports Berserks, controls approaches, and protects the Citadel

## 6. Player Structures

### Citadel

- **Role:** Main base
- **Description:** Central and most important player structure
- **Functions:**
  - Generates Energy
  - Produces Basic Warriors
  - Produces Collectors
- **Lose condition:** If the Citadel is destroyed, the player loses

### Defense Tower

- **Role:** Static defense
- **Description:** Automatically attacks enemies within range

## 7. Enemy Roles

### Standard / Base Enemy

- Current notes indicate a weaker baseline enemy exists, but its final name and complete combat profile need to be clarified in a later combat-focused pass.

### Rune Breaker

- **Role:** Anti-structure tank
- **Description:** Slow but durable enemy that prioritizes Defense Towers in order to clear the path for other attackers

### Mini-Boss: Devourer of Worlds

- **Role:** Elite threat
- **Spawn timing:** Appears at the 5-minute mark
- **Description:** Massive health pool and high damage; requires concentrated fire from all available player forces

## 8. Win / Lose Structure

### Loss

- The Citadel is destroyed

### Victory Path

- Survive the defense phase
- Build up economy and offensive force
- Push outward
- Destroy the enemy portals

## 9. Web3 / On-Chain Direction

### On-Chain Logic

- Core game systems may move fully on-chain:
  - Unit stats
  - Citadel state
  - Damage calculation
  - Movement resolution
- Purpose:
  - Fairness
  - Transparency
  - Anti-cheat integrity

### Living Economy

- Collector-driven Abyss Crystal gathering is envisioned as a stream of microtransactions
- This would be too slow or expensive on regular Solana execution alone
- MagicBlock is the enabling layer that makes this style of interactive economy practical

## 10. Immediate UI / UX Implications

This design has direct implications for Phase `02.1` menu and onboarding work:

- The menu should feel like the command interface of the last Citadel, not a generic placeholder lobby
- The runic / icy blue / cyber-norse visual language is now grounded in the world fiction, not just aesthetic preference
- The wallet screen can explain connection in-world as part of entering the Citadel network and preserving the Code of the Ancestors
- Main menu secondary actions such as `Stats` and `Leaderboard` now have narrative justification inside the Citadel command layer
- Future map select, offensive staging, and portal destruction UI can grow naturally from the same fantasy

## 11. Open Design Questions For Later Phases

- Final roster and names of early/mid-game enemy types
- Exact structure roster beyond Citadel and Defense Tower
- Whether Citadel upgrades happen in-place or via separate tech structures
- Exact transition trigger from defense to counterattack
- How portal destruction is staged mechanically
- Which systems become on-chain first vs remain client-side initially

---

*Document purpose: preserve user-provided game vision as a reusable source for planning, UI, and future gameplay phases.*
