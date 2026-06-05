#!/usr/bin/env python3
"""
Génère un graphique de trafic organique concurrent via DataForSEO API.
Reproduit le graphique "Trafic concurrence · Marché" de SEMrush.
"""

import requests
import json
import base64
from datetime import datetime, timedelta
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import numpy as np

# ── Config ────────────────────────────────────────────────────────────────────
DATAFORSEO_LOGIN = "your_login@example.com"
DATAFORSEO_PASSWORD = "your_password"

DOMAINS = [
    "maisoncatrosgerand.fr",
    "labonnegraine.com",
    "kokopelli-semences.fr",
    "graines-baumaux.fr",
    "fermedesaintemarthe.com",
]

COLORS = {
    "maisoncatrosgerand.fr":    "#4472C4",  # bleu
    "labonnegraine.com":        "#ED7D31",  # orange
    "kokopelli-semences.fr":    "#A9D18E",  # vert clair
    "graines-baumaux.fr":       "#7030A0",  # violet
    "fermedesaintemarthe.com":  "#FFC000",  # jaune/or
}

# ── DataForSEO helpers ────────────────────────────────────────────────────────

def get_auth_header():
    credentials = f"{DATAFORSEO_LOGIN}:{DATAFORSEO_PASSWORD}"
    token = base64.b64encode(credentials.encode()).decode()
    return {"Authorization": f"Basic {token}", "Content-Type": "application/json"}


def fetch_historical_traffic(domains: list[str]) -> dict:
    """
    POST /v3/dataforseo_labs/google/historical_rank_overview/live
    Retourne l'historique mensuel du trafic organique estimé pour chaque domaine.
    """
    url = "https://api.dataforseo.com/v3/dataforseo_labs/google/historical_rank_overview/live"

    # On peut envoyer plusieurs domaines en une seule requête (batch)
    payload = [
        {
            "target": domain,
            "language_code": "fr",
            "location_code": 2250,   # France
        }
        for domain in domains
    ]

    response = requests.post(url, headers=get_auth_header(), json=payload)
    response.raise_for_status()
    return response.json()


def parse_traffic_series(api_response: dict) -> dict[str, dict]:
    """
    Extrait {domain: {date: etv}} depuis la réponse API.
    etv = Estimated Traffic Volume (trafic organique mensuel estimé)
    """
    series = {}

    for task in api_response.get("tasks", []):
        if task.get("status_code") != 20000:
            print(f"Erreur pour une tâche : {task.get('status_message')}")
            continue

        for result in task.get("result", []):
            domain = result.get("target")
            monthly_data = {}

            for item in result.get("items", []):
                # item["metrics"]["organic"]["etv"] = trafic estimé
                date_str = item.get("date")   # format "YYYY-MM-DD"
                etv = (
                    item.get("metrics", {})
                        .get("organic", {})
                        .get("etv", 0)
                )
                if date_str:
                    monthly_data[date_str] = etv

            series[domain] = monthly_data

    return series


# ── Chart ─────────────────────────────────────────────────────────────────────

def build_chart(series: dict[str, dict], output_file: str = "trafic_concurrence.png"):
    fig, ax = plt.subplots(figsize=(14, 6))
    fig.patch.set_facecolor("#F7F4EF")
    ax.set_facecolor("#F7F4EF")

    legend_entries = {}

    for domain, monthly_data in series.items():
        if not monthly_data:
            continue

        # Trie par date
        sorted_items = sorted(monthly_data.items())
        dates = [datetime.strptime(d, "%Y-%m-%d") for d, _ in sorted_items]
        values = [v for _, v in sorted_items]

        color = COLORS.get(domain, "#888888")
        ax.plot(dates, values, color=color, linewidth=2, label=domain)

        # Valeur la plus récente pour la légende
        legend_entries[domain] = values[-1] if values else 0

    # Axes
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%b. %Y"))
    ax.xaxis.set_major_locator(mdates.MonthLocator(interval=2))
    plt.xticks(rotation=0, fontsize=9)

    ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, _: f"{x/1000:.1f}K" if x >= 1000 else str(int(x))))
    ax.tick_params(axis="y", labelsize=9)

    ax.set_ylim(bottom=0)
    ax.grid(axis="y", color="#CCCCCC", linewidth=0.5)
    ax.spines[["top", "right", "left", "bottom"]].set_visible(False)

    # Titre
    ax.set_title("Trafic organique", fontweight="bold", loc="left", fontsize=11, pad=12)

    # Légende en haut à droite avec valeurs actuelles
    legend_text = "\n".join(
        f"● {d}   {int(v/1000)}K" if v >= 1000 else f"● {d}   {int(v)}"
        for d, v in sorted(legend_entries.items(), key=lambda x: -x[1])
    )
    ax.text(
        1.01, 0.98, legend_text,
        transform=ax.transAxes,
        fontsize=8, verticalalignment="top",
        bbox=dict(facecolor="#F7F4EF", edgecolor="none"),
    )

    plt.tight_layout()
    plt.savefig(output_file, dpi=150, bbox_inches="tight")
    print(f"Graphique enregistré : {output_file}")
    return output_file


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("Récupération des données DataForSEO…")
    raw = fetch_historical_traffic(DOMAINS)

    # Sauvegarde la réponse brute pour debug
    with open("dataforseo_raw_response.json", "w") as f:
        json.dump(raw, f, indent=2, ensure_ascii=False)
    print("Réponse brute sauvegardée dans dataforseo_raw_response.json")

    series = parse_traffic_series(raw)

    if not any(series.values()):
        print("Aucune donnée retournée. Vérifiez vos identifiants et crédits API.")
        return

    # Affiche un résumé
    for domain, data in series.items():
        if data:
            latest_date = max(data.keys())
            latest_val = data[latest_date]
            print(f"  {domain}: {int(latest_val/1000)}K visites (dernier mois: {latest_date})")

    build_chart(series)


if __name__ == "__main__":
    main()
