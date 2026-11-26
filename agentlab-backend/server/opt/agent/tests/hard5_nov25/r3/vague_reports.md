# Bug reports from users (more-itertools fork)

Please triage each one. Some are real bugs, some are users misunderstanding documented behaviour.

1. **@kwame**: "When I pass `initial=0` to `difference()` it doesn't undo `accumulate(..., initial=0)`. `list(difference(accumulate([1, 2, 3], initial=0), initial=0))` should give `[1, 2, 3]` but I get something else. `initial=10` works fine."
2. **@mira**: "`unique_everseen` with a key function that returns a list doesn't de-duplicate. `list(unique_everseen(['ab', 'ba', 'cd'], key=lambda s: sorted(s)))` should be `['ab', 'cd']` because 'ab' and 'ba' have the same key."
3. **@jonas**: "The dict returned by `map_reduce` acts weird. Looking up a key that isn't there silently gives me an empty list (and then the key shows up in the dict!) instead of raising KeyError like the docs say."
4. **@li**: "`islice_extended` gives the wrong items for some negative stops: `list(islice_extended(range(10))[2:-2])` should be `[2, 3, 4, 5, 6, 7]`, the same as `list(range(10))[2:-2]`."
5. **@pat**: "`chunked(range(7), 3)` leaves a short last chunk `[6]`. That's a bug, it should pad the last chunk with None like zip_longest does."
6. **@sven**: "`windowed([1, 2, 3], 4)` returns `[(1, 2, 3, None)]`. When the window is bigger than the input it should return nothing."
