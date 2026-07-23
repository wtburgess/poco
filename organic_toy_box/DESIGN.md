---
name: Organic Toy Box
colors:
  surface: '#f3faff'
  surface-dim: '#b9e0f1'
  surface-bright: '#f3faff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#e5f6ff'
  surface-container: '#d7f2ff'
  surface-container-high: '#c8eeff'
  surface-container-highest: '#c1e9fa'
  on-surface: '#001f29'
  on-surface-variant: '#42493d'
  inverse-surface: '#083542'
  inverse-on-surface: '#def4ff'
  outline: '#73796c'
  outline-variant: '#c2c9b9'
  surface-tint: '#3e6928'
  primary: '#3c6626'
  on-primary: '#ffffff'
  primary-container: '#54803c'
  on-primary-container: '#f8ffee'
  inverse-primary: '#a3d487'
  secondary: '#705a49'
  on-secondary: '#ffffff'
  secondary-container: '#f8dac5'
  on-secondary-container: '#755e4d'
  tertiary: '#864f00'
  on-tertiary: '#ffffff'
  tertiary-container: '#a96400'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#bef1a0'
  primary-fixed-dim: '#a3d487'
  on-primary-fixed: '#072100'
  on-primary-fixed-variant: '#275012'
  secondary-fixed: '#fbddc7'
  secondary-fixed-dim: '#dec1ac'
  on-secondary-fixed: '#28180b'
  on-secondary-fixed-variant: '#574333'
  tertiary-fixed: '#ffdcbd'
  tertiary-fixed-dim: '#ffb86d'
  on-tertiary-fixed: '#2c1600'
  on-tertiary-fixed-variant: '#683c00'
  background: '#f3faff'
  on-background: '#001f29'
  surface-variant: '#c1e9fa'
typography:
  display-lg:
    fontFamily: Nunito Sans
    fontSize: 48px
    fontWeight: '900'
    lineHeight: 56px
    letterSpacing: -0.02em
  display-sm:
    fontFamily: Nunito Sans
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 40px
  headline-md:
    fontFamily: Nunito Sans
    fontSize: 24px
    fontWeight: '800'
    lineHeight: 32px
  body-lg:
    fontFamily: Work Sans
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 28px
  body-md:
    fontFamily: Work Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-bold:
    fontFamily: Work Sans
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 20px
  display-lg-mobile:
    fontFamily: Nunito Sans
    fontSize: 36px
    fontWeight: '900'
    lineHeight: 42px
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  unit: 8px
  container-padding: 24px
  gutter: 16px
  border-width: 2.5px
---

## Brand & Style
The design system is built on a "Tactile Toy-Box" philosophy. It transforms the often-rigid nature of life tracking into a playful, unhurried experience that feels like interacting with a physical board game or a hand-crafted journal. The aesthetic is "Chunky-Organic"—it prioritizes soft, oversized touch targets, thick strokes, and physical metaphors over digital abstraction.

The emotional response should be one of "gentle encouragement." By using hand-drawn adjacent elements and "squishy" visual logic, the UI lowers the stakes of habit tracking, making failure feel less punishing and progress feel like a tangible collection of artifacts. 

**Visual Style Guidelines:**
- **Toy-like Physics:** Elements should feel like they have weight. Buttons "depress" rather than just changing color.
- **Organic Imperfection:** Avoid perfect geometric circles or squares where possible; lean into slightly wobbly paths and variable stroke widths.
- **Texture:** Apply a global low-opacity grain overlay (3-5%) to all surfaces to simulate the feel of recycled paper and matte plastic.

## Colors
The palette is grounded in an "Enchanted Forest" theme. The primary **Moss Green** serves as the color of growth and success. The **Deep Bark Brown** provides grounding and structural integrity, used primarily for text and thick borders. 

**Color Usage:**
- **Primary (Moss Green):** Progress indicators, positive actions, and "growth" states.
- **Secondary (Deep Bark):** High-contrast text, primary outlines (2pt), and structural containers.
- **Accent (Mango Orange):** High-priority alerts, streaks, and celebratory moments.
- **Neutral (Sky Blue):** Secondary buttons, background containers for data, and "inactive" but healthy states.
- **Background (Cream Paper):** The universal canvas. Never use pure white.

## Typography
The typography system uses a "Soft-Heavy" contrast. Headlines are rendered in **Nunito Sans** with maximum weights to emphasize the friendly, rounded nature of the brand. For data points and large numbers, always use the heaviest weight available to make statistics feel like collectible "tokens."

**Work Sans** is used for body copy and labels to maintain legibility. Its grounded, professional construction balances the whimsy of the headings, ensuring the app remains a functional tool. 

- **Headings:** Use ExtraBold or Black weights. Letter spacing should be tightened slightly (-2%) to create a cohesive "sticker" look.
- **Body:** Use Regular or Medium weights. Ensure ample line height (1.5x+) to maintain the unhurried, breathable feel.

## Layout & Spacing
The layout follows a "Loose Grid" philosophy. While it adheres to an 8px base unit for alignment, the visual margins are generous to prevent the UI from feeling "cramped" or "corporate."

**Key Principles:**
- **External Margins:** Use a minimum of 24px on mobile to keep interactive elements away from screen edges.
- **Card Spacing:** Use 16px (gutter) between cards to allow the soft drop shadows room to breathe.
- **Content Flow:** Content should be centered and vertically stacked, mimicking a scroll or a list of tasks. Avoid complex multi-column layouts on mobile to keep the experience "unhurried."

## Elevation & Depth
Elevation in this design system is achieved through "Physical Stacking" rather than light-source simulation. 

**Shadows & Outlines:**
- **The Signature Border:** Every interactive element or distinct container must have a 2.5px solid border in **Deep Bark Brown**.
- **Soft Drop Shadows:** Use "Ambient Blobs"—low-offset shadows (e.g., `0px 4px 0px`) with high blur and low opacity (10-15%) using the Secondary color as a base. This makes cards look like they are hovering slightly off the paper.
- **Active State:** When pressed, buttons should lose their shadow and move 2px down (Y-axis), simulating a physical click.

## Shapes
The shape language is "Hyper-Rounded." Sharp corners are strictly prohibited. 

**Shape Rules:**
- **Standard Containers:** Use a minimum radius of 24px.
- **Small Elements (Chips/Labels):** Use fully pill-shaped (rounded-full) corners.
- **Organic Interruptions:** Progress bars should not be straight rectangles; they should have slight "waists" or "bulges" like a vine or a leaf. Use SVG masks to create slightly irregular, hand-drawn edges for large image containers or decorative backgrounds.

## Components

### Buttons
- **Primary:** Moss Green background, Deep Bark 2.5px border, Heavy Shadow. 
- **Secondary:** Sky Blue background, Deep Bark 2.5px border.
- **Tertiary:** Transparent background, Deep Bark border, rounded-full.

### Cards & Containers
- Cards should always be Cream Paper or very light tints of the brand colors. 
- Ensure a 2.5px border is present.
- Use "Leaf" or "Stone" icons as decorative corner flourishes to break the geometric rigidity.

### Input Fields
- Inputs should look like "wells" carved into the paper. Use a 2.5px Deep Bark border with a slightly darker cream background (#F2EBD4) to indicate the "inset" area.

### Progress Indicators
- **The "Vine" Bar:** Instead of a flat bar, use a stylized vine that grows leaves as the percentage increases.
- **The "Jar" Container:** For count-based goals, use a jar shape that fills with Mango Orange "tokens" or "fireflies."

### List Items
- Separate list items with 8px of vertical space. 
- Each item is its own rounded container with a border. Do not use simple divider lines.

### Icons
- Icons must be "thick-weight" (2pt minimum). 
- Use closed loops and rounded ends. Avoid sharp terminals. 
- If possible, add a single "doodle" line or a small colored blob behind the icon to give it an illustrated feel.