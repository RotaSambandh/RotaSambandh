# Rotaract clubs list

Update `rotaract-clubs.csv` anytime. The app reads it on the next build/server start.

## Format

```csv
district,club_name
3191,Bangalore East
3191,Bangalore West
3192,Example City
```

- Header row required: `district,club_name` (aliases `District`, `club`, `Club Name` also work)
- Club names only — no `Rotaract Club of` prefix (the form label already says Rotaract club)
- One club per row
- Quotes allowed for names with commas: `3191,"Foo, Bar"`
