import base64
import datetime as dt
import json
from pathlib import Path

import requests

AS_OF_DATE = dt.date.today()
OUTPUT_JSON = Path("data.json")
OUTPUT_JS = Path("data.js")

# Ordered by Forbes rank after we pull the live list.
PARTNER_DATA = {
    "Mark Zuckerberg": {
        "partner_name": "Priscilla Chan",
        "partner_birth_date": "1985-02-24",
        "partner_source": "https://en.wikipedia.org/wiki/Priscilla_Chan",
    },
    "Jeff Bezos": {
        "partner_name": "Lauren Sanchez Bezos",
        "partner_birth_date": "1969-12-19",
        "partner_source": "https://en.wikipedia.org/wiki/Lauren_S%C3%A1nchez_Bezos",
    },
    "Bernard Arnault & family": {
        "partner_name": "Helene Mercier-Arnault",
        "partner_birth_date": "1960-02-05",
        "partner_source": "https://en.wikipedia.org/wiki/H%C3%A9l%C3%A8ne_Mercier-Arnault",
    },
    "Amancio Ortega": {
        "partner_name": "Flora Perez Marcote",
        "partner_birth_date": "1952-10-14",
        "partner_source": "https://es.wikipedia.org/wiki/Flora_P%C3%A9rez",
    },
    "Michael Bloomberg": {
        "partner_name": "Diana Taylor",
        "partner_birth_date": "1955-02-06",
        "partner_source": "https://en.wikipedia.org/wiki/Diana_Taylor_(superintendent)",
    },
    "Mukesh Ambani": {
        "partner_name": "Nita Ambani",
        "partner_birth_date": "1963-11-01",
        "partner_source": "https://en.wikipedia.org/wiki/Nita_Ambani",
    },
    "Gianluigi Aponte": {
        "partner_name": "Rafaela Aponte-Diamant",
        "partner_birth_date": "1945-03-26",
        "partner_source": "https://en.wikipedia.org/wiki/Rafaela_Aponte-Diamant",
    },
    "Eric Schmidt": {
        "partner_name": "Wendy Schmidt",
        "partner_birth_date": "1955-07-26",
        "partner_source": "https://en.wikipedia.org/wiki/Wendy_Schmidt",
    },
    "Fran\u00e7ois Pinault & family": {
        "partner_name": "Salma Hayek",
        "partner_birth_date": "1966-09-02",
        "partner_source": "https://en.wikipedia.org/wiki/Salma_Hayek",
    },
    "Dustin Moskovitz": {
        "partner_name": "Cari Tuna",
        "partner_birth_date": "1985-10-04",
        "partner_source": "https://en.wikipedia.org/wiki/Cari_Tuna",
    },
}


def b64(value: str) -> str:
    return base64.b64encode(value.encode("utf-8")).decode("ascii")


def age_on_date(birth_date: str, on_date: dt.date) -> int:
    born = dt.date.fromisoformat(birth_date)
    before_birthday = (on_date.month, on_date.day) < (born.month, born.day)
    return on_date.year - born.year - int(before_birthday)


def fetch_forbes_top(limit: int = 200) -> list[dict]:
    params = {
        "listUri": b64("billionaires"),
        "year": b64("2025"),
        "limit": b64(str(limit)),
        "sortBy": b64("finalWorth"),
        "sortOrder": b64("DESC"),
        "search": "",
        "searchKey": "",
        "offset": b64("0"),
        "filter": "",
        "filterFields": "",
    }
    response = requests.get(
        "https://www.forbes.com/lists-api/getListData",
        params=params,
        headers={"User-Agent": "Mozilla/5.0"},
        timeout=30,
    )
    response.raise_for_status()
    return response.json()["data"]


def build_rows() -> list[dict]:
    forbes_data = fetch_forbes_top()
    records = []
    for person in forbes_data:
        name = person["personName"]
        if name not in PARTNER_DATA:
            continue
        partner = PARTNER_DATA[name]
        partner_age = age_on_date(partner["partner_birth_date"], AS_OF_DATE)
        billionaire_age = int(person["age"])
        worth_billion = round(float(person["finalWorth"]) / 1000.0, 1)
        records.append(
            {
                "rank": int(person["rank"]),
                "person_name": name,
                "worth_billion_usd": worth_billion,
                "billionaire_age": billionaire_age,
                "partner_name": partner["partner_name"],
                "partner_age": partner_age,
                "age_gap_partner_minus_billionaire": partner_age - billionaire_age,
                "forbes_source": "https://www.forbes.com/billionaires/",
                "partner_source": partner["partner_source"],
            }
        )
    records.sort(key=lambda item: item["rank"])
    if len(records) != 10:
        found = ", ".join(r["person_name"] for r in records)
        raise RuntimeError(f"Expected 10 records, found {len(records)}: {found}")
    return records


def main() -> None:
    rows = build_rows()
    payload = {
        "title": "10 Richest People With Known Partner Ages",
        "as_of_date": AS_OF_DATE.isoformat(),
        "forbes_list_year": 2025,
        "rows": rows,
    }
    OUTPUT_JSON.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    OUTPUT_JS.write_text(
        "window.RICHEST_PARTNER_DATA = " + json.dumps(payload, indent=2) + ";\n",
        encoding="utf-8",
    )
    print(f"Wrote {OUTPUT_JSON} and {OUTPUT_JS}")


if __name__ == "__main__":
    main()
