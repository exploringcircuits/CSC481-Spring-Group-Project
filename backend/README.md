## How To Setup The Backend Server

**FIRST INSTALL IN TERMINAL**
```
python -m pip install Django

python -m pip install djangorestframework

python -m pip install djangorestframework-camel-case

python -m pip install django-cors-headers
```

**THEN INITIALIZE THE DATABASE**
```
python manage.py migrate
```

**HOW TO RUN**
```
python manage.py runserver
```
---

## How To Test Fantasy Basketball League

1. First, create a league with a `POST` request to http://127.0.0.1:8000/api/leagues/

   Then paste:
```
  {
  "name": "Test League",
  "commissioner_email": "me@test.com",
  "invite_emails": ["a@test.com","b@test.com","c@test.com"],
  "max_players": 4
  }
```

2. Then view the created league at http://127.0.0.1:8000/api/leagues/1/

3. Next, start the draft with a `POST` request to http://127.0.0.1:8000/api/leagues/1/start-draft/

  Then paste:
```
{
  "starter_email": "me@test.com"
}
```

4. Next, make picks for your team with a `POST` request to http://127.0.0.1:8000/api/leagues/1/pick/

  Then paste:
```
{
  "email": "me@test.com",
  "player_id": 2544
}

(read through players.json, "PERSON_ID" = "player_id")
```

And repeat until everyone has a full team.

*View teams at http://127.0.0.1:8000/api/leagues/1/teams

*Reset league at http://127.0.0.1:8000/api/leagues/1/reset

and paste:
```
{
  "starter_email": "me@test.com"
}
```

It will only reset the league with the commisioner email.

---

## How to Propose and Manage Trades Between Other Users

1. First, you must make sure the league status is "ACTIVE," which means every user has drafted their complete team.

2. To propose a trade go to http://127.0.0.1:8000/api/leagues/1/trades/propose/

3. You can then view all the current trades at http://127.0.0.1:8000/api/leagues/1/trades/

4. To view one trade go to http://127.0.0.1:8000/api/trades/1/

5. To accept the trade go to http://127.0.0.1:8000/api/trades/1/accept/

  Then paste:
```
{
  "acting_email": "a@test.com"
}

(Only the receiver of the proposal can accept)
```

6. To reject a trade go to http://127.0.0.1:8000/api/trades/1/reject/

   Then paste:
```
{
  "acting_email": "a@test.com"
}

(Only the receiver of the proposal can reject)
```

7. To cancel a trade go to http://127.0.0.1:8000/api/trades/<trade_id>/cancel/

   Then paste:
```
{
  "acting_email": "me@test.com"
}

(Only the user that made the proposal can cancel)
```

---
                                                                                  
## How To Test League Progression (Playoffs)

Prerequisites: League status must be ACTIVE (all teams have completed their draft).

If you need to quickly set up a test league, see the "quick setup with bots" section below.

1. Start the playoffs with a POST request to http://127.0.0.1:8000/api/leagues/<league_id>/start-playoffs/

   Then paste:
```
   {
   "commissioner_email": "me@test.com"                                                
   }
```
   This creates two semifinal matchups and moves the league to PLAYOFFS status.      

  2. View the bracket at http://127.0.0.1:8000/api/leagues/<league_id>/bracket/

  3. This returns the full bracket with all matchups, scores, and player stats.
   
  4. Find the two semifinal matchup IDs from the bracket response, then simulate the first semifinal with a POST request to
  http://127.0.0.1:8000/api/leagues/<league_id>/matchups/<match_number>/simulate/

  5. Then paste:
```
  {
    "commissioner_email": "me@test.com",
    "seed": 42
  }
```
   The seed field is optional — include it for repeatable results, omit it for a random simulation.

  6. Simulate the second semifinal with a POST request to
  http://127.0.0.1:8000/api/leagues/<league_id>/matchups/<match_number>/simulate/

  7. Then paste:
```
  {
    "commissioner_email": "me@test.com",
    "seed": 99
  }
```
   Once both semifinals are simulated, the final matchup is automatically created.   

  9. Check the bracket again at http://127.0.0.1:8000/api/leagues/<league_id>/bracket/ to get the final matchup ID (match_number), then simulate it with a POST request to http://127.0.0.1:8000/api/leagues/<league_id>/matchups/<match_number>/simulate/

  10. Then paste:
```
  {
    "commissioner_email": "me@test.com",
    "seed": 7
  }
```
   This sets the champion and moves the league status to COMPLETE.

  11. View the final bracket and champion at http://127.0.0.1:8000/api/leagues/<league_id>/bracket/

---

## Quick Setup with Bots

To skip manual drafting and jump straight to playoffs, use these two commands after creating a league:

  1. Fill empty slots with bot players with a POST request to http://127.0.0.1:8000/api/leagues/<league_id>/fill-bots/

     No body required — bots are auto-assigned emails.
  
  2. Auto-fill all team rosters with a POST request to http://127.0.0.1:8000/api/leagues/<league_id>/auto-draft/

  3. No body required — randomly assigns players from the database to every team and completes the draft. League status becomes ACTIVE.

---
