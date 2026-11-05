from datetime import date
from fastapi import FastAPI, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text

from database import get_db
from ml import get_real_predictions

app = FastAPI(title="MRI - Water Intelligence API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

VALID_DAMS = [
    "Al Wahda",
    "Al Massira",
    "Bin El Ouidane",
    "Idriss Ier",
    "Oued El Makhazine",
    "Mansour Eddahbi",
]

CACHE_METEO_JOUR = {}


def extraire_taux_jour_1(resultats_ml, taux_defaut: float) -> float:
    try:
        donnees = resultats_ml
        if isinstance(donnees, dict):
            for cle in ["predictions", "forecast", "data", "resultats", "history_and_forecast"]:
                if cle in donnees and isinstance(donnees[cle], list):
                    donnees = donnees[cle]
                    break

        if isinstance(donnees, list) and len(donnees) > 0:
            jour_cible = donnees[-1]
            if isinstance(jour_cible, dict):
                for cle_taux in [
                    "taux_remplissage", "predicted", "prevision",
                    "level", "taux", "fillRate", "fill_rate", "value"
                ]:
                    if cle_taux in jour_cible and jour_cible[cle_taux] is not None:
                        return round(float(jour_cible[cle_taux]), 2)
    except Exception:
        pass
    return taux_defaut


@app.get("/")
def read_root():
    return {"message": "API MRI Water Intelligence opérationnelle"}


@app.get("/barrages")
def get_barrages():
    return {"barrages": VALID_DAMS}


@app.get("/current-levels")
def get_current_levels(db: Session = Depends(get_db)):
    try:
        query = text("""
            WITH RankedRecords AS (
                SELECT barrage, taux_remplissage, date,
                       ROW_NUMBER() OVER(PARTITION BY barrage ORDER BY date DESC) as rn
                FROM historique_barrages
            )
            SELECT barrage,
                   MAX(CASE WHEN rn = 1 THEN taux_remplissage END) as taux_actuel,
                   MAX(CASE WHEN rn = 1 THEN date END) as date_actuelle,
                   MAX(CASE WHEN rn = 2 THEN taux_remplissage END) as taux_precedent
            FROM RankedRecords
            WHERE rn <= 2
            GROUP BY barrage;
        """)
        result = db.execute(query).fetchall()

        aujourd_hui = str(date.today())
        dams_data = {}

        for row in result:
            nom_barrage = row.barrage
            taux_db_actuel = float(row.taux_actuel) if row.taux_actuel is not None else 0.0
            taux_db_precedent = float(row.taux_precedent) if row.taux_precedent is not None else taux_db_actuel

            taux_final_actuel = taux_db_actuel
            taux_final_precedent = taux_db_precedent
            date_maj = str(row.date_actuelle)

            if nom_barrage in VALID_DAMS:
                cle_cache = f"{nom_barrage}_{aujourd_hui}"
                try:
                    if cle_cache not in CACHE_METEO_JOUR:
                        pred_j1 = get_real_predictions(
                            nom_barrage,
                            temp_delta=0.0,
                            rain_multiplier=100,
                            horizon=1
                        )
                        CACHE_METEO_JOUR[cle_cache] = extraire_taux_jour_1(pred_j1, taux_db_actuel)

                    taux_estime_jour = CACHE_METEO_JOUR[cle_cache]

                    if taux_estime_jour != taux_db_actuel:
                        taux_final_precedent = taux_db_actuel
                        taux_final_actuel = taux_estime_jour
                        date_maj = aujourd_hui
                except Exception:
                    pass

            dams_data[nom_barrage] = {
                "taux_remplissage": taux_final_actuel,
                "taux_precedent": taux_final_precedent,
                "derniere_mise_a_jour": date_maj
            }

        return dams_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur de lecture DB : {str(e)}")


@app.get("/predict")
def get_prediction(
    barrage: str = Query(...),
    temp_delta: float = Query(0.0),
    rain_multiplier: float = Query(1.0),
    horizon: int = Query(7)
):
    if barrage not in VALID_DAMS:
        raise HTTPException(status_code=404, detail="Barrage non trouvé")

    try:
        return get_real_predictions(
            barrage,
            temp_delta=temp_delta,
            rain_multiplier=rain_multiplier * 100,
            horizon=horizon
        )
    except FileNotFoundError as fnf_error:
        raise HTTPException(status_code=500, detail=str(fnf_error))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur interne : {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)