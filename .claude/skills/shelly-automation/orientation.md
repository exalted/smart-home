# Orientation: sun and rain on each side of the home

Which way each cover faces is in CLAUDE.md (Home setup > Orientation, and the Faces column of the device table): NNE ~28°, ESE ~118°, SSW ~208°, WNW ~298°, read from the user's map on 2026-10-02 (±5°). Nothing notable shades any side. Exact sun times per side for every month are in `CLAUDE.local.md`, because they locate the home; the times here are rounded on purpose.

## Sun

Computed 2026-10-02 (NOAA solar position algorithm, clear sky, geometric horizon). "Strong" means the sun is within 60° of perpendicular to the glass.

- **WNW** (porta soggiorno, studio, camera ospiti, porta camera ospiti): the summer heat side. Sun from about 14:00 to sunset all year, strong from about 16:00 to sunset; from May to August that is four to five hours of low, hot sun straight into the rooms. In winter only a weak couple of hours before sunset.
- **ESE** (cucina, bagno ospiti, bagno matrimoniale, porta matrimoniale): the morning side. Sun from sunrise to about 14:00 all year, strong until about 11:30–12:00. In summer it starts at sunrise, before 06:00, so the master bedroom's door gets direct sun at dawn; the same morning sun is why lowering the kitchen at sunrise (`kitchen-morning`) makes sense. In winter the low morning sun hits this side almost head-on: free warmth.
- **SSW** (porta cucina): the winter side. From November to February sun almost all day, strong from mid-morning to sunset. In summer the sun is high and only grazes it (on it from about 11:00 to 20:00, rarely strong); strongest in the afternoons of March–April and August–September.
- **NNE** (soggiorno): sun only from April to August, from sunrise to about 10:00–11:00, strong only until about 08:00; none at all from November to January. Never a heat problem; at most early glare in summer.

Summer heat, most to least: WNW afternoons, then ESE mornings, then porta cucina in spring and late-summer afternoons; the soggiorno window never.

## Rain

Rain needs wind to reach a window: a side gets wet when the wind comes *from* within about ±60° of the way it faces. Driven-rain share per side, from Open-Meteo's ERA5 archive (hourly, 2016–2025, at the home's location rounded to one decimal; hours with ≥ 0.2 mm, weighted by rain × wind speed × how squarely the wind hits the side; computed 2026-10-02; model data, not observed on site):

| Side | Share of driven rain | Wind directions that hit it (from) | Seasons |
|---|---|---|---|
| NNE (soggiorno) | 35 % | ~330°–90° (NNW to E) | most in spring (43 %) |
| WNW (porta soggiorno, studio, camera ospiti ×2) | 32 % | ~240°–360° (WSW to N) | most in summer (38 %), storms from the west |
| ESE (cucina, bagni, porta matrimoniale) | 20 % | ~60°–180° (ENE to S) | least in summer |
| SSW (porta cucina) | 14 % | ~150°–270° (SSE to W) | rare all year |

During rain the wind blows most often from NE (24 % of driven rain), then W (19 %), NW (16 %), N (14 %) and E (13 %); SE, S and SW are rare (6 % or less each).

Observed (user, 2026-10-02): virtually every opening is sheltered by the roof, so plain rain doesn't reach them; the bathroom windows hardly ever get wet. Slanted or windblown rain does reach some, most exposed first:

1. **The doors** (porta soggiorno, porta camera ospiti, porta matrimoniale, porta cucina): they reach the floor, so rain lands on the threshold.
2. **Studio** (WNW): roofed, but one of the outermost windows of the home.
3. **Soggiorno** (NNE): the roof above it is very high, so even a small angle lets the rain in.

The rest (cucina, camera ospiti, both bathrooms) rarely get wet. So for rain the side the wind comes from picks the covers, and this order decides which of them matter.

## Covers that act together

| Purpose | Covers | Door covers among them |
|---|---|---|
| Summer afternoon sun | WNW: porta soggiorno, studio, camera ospiti, porta camera ospiti | porta soggiorno, porta camera ospiti |
| Morning sun (summer, or a late sleeper) | ESE: cucina, porta matrimoniale (bathrooms if wanted) | porta matrimoniale |
| Rain from W to NW (summer storms) | studio; the two west doors are more exposed still; camera ospiti only in heavy wind | porta soggiorno, porta camera ospiti |
| Rain from N to NE (the most frequent) | soggiorno | none |
| Rain from E to SE | porta matrimoniale; cucina and the bathrooms stay dry | porta matrimoniale |
| Rain from S to SW (rare) | porta cucina | porta cucina |
| Winter warmth by day | keep ESE open in the morning, SSW all day, WNW in the afternoon; close at sunset to keep the heat in | all four door covers if "close at sunset" includes them |

For rain, the windows worth watching come down to two: studio (wind from W to NW) and soggiorno (wind from N to NE). The doors are the most exposed openings of all, and they are exactly the ones whose covers must not close by themselves: **closing a door cover automatically can lock someone out on the balcony or terrace**, and rain is when someone steps out to fetch laundry or plants (SKILL.md). That fits the user's choice for rain detection: send a notification and let a person close what needs closing (2026-10-02), for doors and windows alike. A door contact sensor only proves the door is shut, not that nobody is outside: someone can pull the door closed behind them. Almost every group above includes a door cover, so the same reminder applies to sun and winter automations; a windows-only variant leaves them out (on the west side that is studio and camera ospiti). Shutters' obstruction detection protects the motor, not people.

## Building on this

- Each cover can carry its own facing as an argument (e.g. `{"facing": 298}`), so one generic rain or sun script works on every device (shelly-scripts skill): close when it rains and the wind comes from within ±60° of `facing`.
- Device schedules can approximate "sun on this side" with month ranges built from the sun times in `CLAUDE.local.md` (e.g. WNW lowered from about 15:30, May to September).
- The devices' sunrise/sunset come from their own `Sys` location, which is close enough to the home's (under a minute apart; `CLAUDE.local.md`).
