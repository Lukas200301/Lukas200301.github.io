import os
import json
from datetime import datetime, timezone
import requests

GITHUB_USERNAME = "Lukas200301"
SITE_REPO = f"{GITHUB_USERNAME}.github.io"
TOKEN = os.environ.get("PRIVATE_STATS_TOKEN")

# List your private repositories to include in your stats:
PRIVATE_REPOS = [
    "Discord_Bot",
    "Joyn-Desktop",
    "GeoFlags",
    "werra-realitatis",
    "mmm-events",
    "Velio",
    "SpectraTune",
]

HEADERS = {
    "Accept": "application/vnd.github.v3+json",
}
if TOKEN:
    HEADERS["Authorization"] = f"Bearer {TOKEN}"

GRAPHQL_URL = "https://api.github.com/graphql"

def fetch_rest(url):
    r = requests.get(url, headers=HEADERS)
    if r.status_code == 200:
        return r.json()
    print(f"Warning REST: {url} -> {r.status_code}")
    return None

def fetch_graphql(query, variables):
    if not TOKEN:
        print("Error: No TOKEN provided for GraphQL queries.")
        return None
    r = requests.post(
        GRAPHQL_URL,
        headers={"Authorization": f"Bearer {TOKEN}"},
        json={"query": query, "variables": variables}
    )
    if r.status_code == 200:
        res = r.json()
        if "errors" in res:
            print(f"GraphQL Errors: {res['errors']}")
        return res.get("data")
    print(f"GraphQL Request failed -> Status {r.status_code}")
    return None

def without_volatile_fields(data):
    """Copy of the stats without the fields that change on every run: the timestamp and the
    site repo's own pushed_at, which the nightly commit itself bumps."""
    data = json.loads(json.dumps(data))  # round trip so int keys compare equal to the loaded file
    data.pop("updated_at", None)
    for repo in data.get("repositories", []):
        if repo.get("name") == SITE_REPO:
            repo.pop("pushed_at", None)
    return data

def get_contribution_calendar():
    """Fetches the full contribution calendar history using the GitHub GraphQL API."""
    query = """
    query($login: String!, $from: DateTime, $to: DateTime) {
      user(login: $login) {
        contributionsCollection(from: $from, to: $to) {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                contributionCount
                date
                weekday
              }
            }
          }
        }
      }
    }
    """
    
    current_year = datetime.now(timezone.utc).year
    # Go back to your starting year (2020)
    start_year = 2020
    all_days = {}
    yearly_totals = {}

    for year in range(start_year, current_year + 1):
        from_date = f"{year}-01-01T00:00:00Z"
        to_date = f"{year}-12-31T23:59:59Z"
        
        data = fetch_graphql(query, {"login": GITHUB_USERNAME, "from": from_date, "to": to_date})
        if not data or not data.get("user"):
            continue
            
        calendar = data["user"]["contributionsCollection"]["contributionCalendar"]
        yearly_totals[year] = calendar["totalContributions"]
        
        for week in calendar["weeks"]:
            for day in week["contributionDays"]:
                all_days[day["date"]] = {
                    "count": day["contributionCount"],
                    "weekday": day["weekday"]
                }

    # Streak and weekday calculation
    sorted_dates = sorted(all_days.keys())
    total_contributions = sum(yearly_totals.values())
    active_days = sum(1 for d in all_days.values() if d["count"] > 0)
    
    # Weekday averages (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    weekday_counts = {i: {"total": 0, "days": 0} for i in range(7)}
    for day_info in all_days.values():
        w = day_info["weekday"]
        weekday_counts[w]["total"] += day_info["count"]
        weekday_counts[w]["days"] += 1
        
    weekday_averages = {
        w: round(weekday_counts[w]["total"] / max(weekday_counts[w]["days"], 1), 2)
        for w in range(7)
    }

    # Calculate current streak
    current_streak = 0
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    for d in reversed(sorted_dates):
        if d > today_str:
            continue
        if all_days[d]["count"] > 0:
            current_streak += 1
        elif d == today_str:
            # If no contributions yet today, streak from yesterday remains intact
            continue
        else:
            break

    return {
        "total_contributions": total_contributions,
        "active_days": active_days,
        "current_streak": current_streak,
        "yearly_totals": yearly_totals,
        "weekday_averages": weekday_averages,
        "calendar_days": all_days
    }

def main():
    print("Collecting repositories...")
    repos_data = []

    # 1. Fetch public repositories
    page = 1
    while True:
        url = f"https://api.github.com/users/{GITHUB_USERNAME}/repos?per_page=100&page={page}&type=public"
        batch = fetch_rest(url)
        if not batch:
            break
        for repo in batch:
            if repo.get("fork"):
                continue
            langs = fetch_rest(repo["languages_url"]) or {}
            repos_data.append({
                "name": repo["name"],
                "full_name": repo["full_name"],
                "html_url": repo["html_url"],
                "is_private": False,
                "created_at": repo["created_at"],
                "pushed_at": repo["pushed_at"],
                "stars": repo.get("stargazers_count", 0),
                "forks": repo.get("forks_count", 0),
                "open_issues": repo.get("open_issues_count", 0),
                "topics": repo.get("topics", []),
                "primary_language": repo["language"],
                "languages": langs,
                "archived": repo.get("archived", False),
                "description": repo.get("description", "")
            })
        page += 1

    # 2. Fetch configured private repositories
    for repo_name in PRIVATE_REPOS:
        url = f"https://api.github.com/repos/{GITHUB_USERNAME}/{repo_name}"
        repo = fetch_rest(url)
        if repo and repo.get("id"):
            langs = fetch_rest(repo["languages_url"]) or {}
            repos_data.append({
                "name": repo["name"],
                "full_name": repo["full_name"],
                "html_url": None,  # Intentionally null for visitors
                "is_private": True,
                "created_at": repo["created_at"],
                "pushed_at": repo["pushed_at"],
                "stars": repo.get("stargazers_count", 0),
                "forks": repo.get("forks_count", 0),
                "open_issues": repo.get("open_issues_count", 0),
                "topics": repo.get("topics", []),
                "primary_language": repo["language"],
                "languages": langs,
                "archived": repo.get("archived", False),
                "description": repo.get("description", "")
            })

    # 3. Profile: followers, following and account age
    print("Fetching profile...")
    user = fetch_rest(f"https://api.github.com/users/{GITHUB_USERNAME}") or {}
    profile = {
        "followers": user.get("followers"),
        "following": user.get("following"),
        "public_repos": user.get("public_repos"),
        "public_gists": user.get("public_gists"),
        "created_at": user.get("created_at"),
    }

    # 4. Forks other people made of my public repositories (forks of private repos stay private)
    print("Fetching forks...")
    forks_list = []
    for r in repos_data:
        if r["is_private"] or not r["forks"]:
            continue
        page = 1
        while True:
            batch = fetch_rest(f"https://api.github.com/repos/{r['full_name']}/forks?per_page=100&page={page}&sort=newest")
            if not batch:
                break
            for f in batch:
                forks_list.append({
                    "repo": r["name"],
                    "full_name": f["full_name"],
                    "owner": f["owner"]["login"],
                    "html_url": f["html_url"],
                    "created_at": f["created_at"],
                    "pushed_at": f["pushed_at"],
                    "stars": f.get("stargazers_count", 0),
                })
            page += 1
    forks_list.sort(key=lambda f: f["created_at"], reverse=True)

    # never overwrite good data with an empty result when the API is down or rate-limited
    if not repos_data or profile["followers"] is None:
        raise SystemExit("Error: GitHub API returned no repositories or no profile, keeping the old stats-data files.")

    # Calculate overall language distribution across all repos
    language_bytes = {}
    for r in repos_data:
        for lang, byte_count in r["languages"].items():
            language_bytes[lang] = language_bytes.get(lang, 0) + byte_count

    total_bytes = sum(language_bytes.values()) or 1
    languages_breakdown = [
        {
            "name": lang,
            "bytes": b,
            "percentage": round((b / total_bytes) * 100, 1)
        }
        for lang, b in sorted(language_bytes.items(), key=lambda item: item[1], reverse=True)
    ]

    print("Fetching contribution metrics via GraphQL...")
    contributions = get_contribution_calendar()
    if not contributions["calendar_days"]:
        raise SystemExit("Error: GraphQL returned no contribution calendar, keeping the old stats-data files.")

    output_data = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "total_repositories": len(repos_data),
            "public_repositories": sum(1 for r in repos_data if not r["is_private"]),
            "private_repositories": sum(1 for r in repos_data if r["is_private"]),
            "total_stars": sum(r["stars"] for r in repos_data),
            "total_forks": sum(r["forks"] for r in repos_data),
            "open_issues": sum(r["open_issues"] for r in repos_data),
            "followers": profile["followers"],
            "following": profile["following"],
        },
        "profile": profile,
        "forks": forks_list,
        "languages": languages_breakdown,
        "contributions": contributions,
        "repositories": repos_data
    }

    # data/ at the repository root: GitHub Pages builds with Jekyll, which never publishes dot-folders like .github/
    data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "data")
    os.makedirs(data_dir, exist_ok=True)
    output_path = os.path.join(data_dir, "stats-data.json")

    # keep the old files when nothing but the volatile fields changed, so the workflow skips the commit
    # (otherwise every nightly commit bumps this repo's pushed_at and causes the next one)
    try:
        with open(output_path, encoding="utf-8") as f:
            previous = json.load(f)
    except (OSError, ValueError):
        previous = None
    if previous is not None and without_volatile_fields(previous) == without_volatile_fields(output_data):
        print("Stats unchanged apart from timestamps, keeping the old stats-data files.")
        return

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)

    js_output_path = os.path.join(data_dir, "stats-data.js")
    with open(js_output_path, "w", encoding="utf-8") as f:
        f.write("window.STATS_DATA = ")
        json.dump(output_data, f, separators=(",", ":"), ensure_ascii=False)
        f.write(";\n")

    print(f"Successfully generated {output_path} and {js_output_path}!")

if __name__ == "__main__":
    main()