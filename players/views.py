from datetime import date, datetime

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from nba_api.stats.endpoints import commonplayerinfo, playergamelog
from nba_api.stats.static import players as static_players


# ---------- Helper functions ----------

def parse_birthdate(birthdate_str: str | None):
    if not birthdate_str:
        return None
    # Example format: "1984-12-30T00:00:00"
    return datetime.fromisoformat(birthdate_str).date()


def compute_age(birthdate: date | None) -> int | None:
    if not birthdate:
        return None
    today = date.today()
    return today.year - birthdate.year - (
        (today.month, today.day) < (birthdate.month, birthdate.day)
    )


# ---------- Views ----------

class PlayerDetail(APIView):
    """
    GET /api/players/<player_id>/
    Returns full player profile + recent games + average points
    """

    def get(self, request, player_id: int):
        try:
            # ---- Player profile ----
            info = commonplayerinfo.CommonPlayerInfo(
                player_id=player_id,
                timeout=60,
            )
            df = info.common_player_info.get_data_frame()
            row = df.iloc[0].to_dict()

            birthdate = parse_birthdate(row.get("BIRTHDATE"))
            age = compute_age(birthdate)

            # ---- Game log ----
            gl = playergamelog.PlayerGameLog(
                player_id=player_id,
                season="2024-25",
                season_type_all_star="Regular Season",
                timeout=60,
            )
            df_log = gl.get_data_frames()[0]

            recent_games = (
                df_log[["GAME_DATE", "MATCHUP", "PTS"]]
                .head(10)
                .to_dict(orient="records")
            )

            avg_pts = float(df_log["PTS"].mean()) if len(df_log) else 0.0

            payload = {
                "player_id": int(row.get("PERSON_ID")),
                "name": row.get("DISPLAY_FIRST_LAST"),
                "age": age,
                "height": row.get("HEIGHT"),
                "weight": int(row["WEIGHT"]) if str(row.get("WEIGHT", "")).isdigit() else None,
                "position": row.get("POSITION"),
                "roster_status": row.get("ROSTERSTATUS"),
                "team": {
                    "id": row.get("TEAM_ID"),
                    "name": row.get("TEAM_NAME"),
                    "abbreviation": row.get("TEAM_ABBREVIATION"),
                },
                "recent_games": recent_games,
                "avg_pts": round(avg_pts, 2),
            }

            return Response(payload, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class PlayerSearch(APIView):
    """
    GET /api/players/search/?q=lebron
    Returns matching players with player_id + name
    """

    def get(self, request):
        q = (request.query_params.get("q") or "").strip()

        if not q:
            return Response(
                {"error": "Missing query parameter: q"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        matches = static_players.find_players_by_full_name(q)

        results = [
            {
                "player_id": int(p["id"]),
                "name": p["full_name"],
                "is_active": bool(p.get("is_active")),
            }
            for p in matches[:25]
        ]

        return Response(results, status=status.HTTP_200_OK)
