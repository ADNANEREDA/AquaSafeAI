# AquaSafe AI — Intelligent Hydrological Monitoring and Prediction System

**AquaSafe AI** is a state-of-the-art full-stack web application designed to monitor, analyze, and predict water fill rates for major dams in Morocco. By combining a modern control room interface with a predictive Machine Learning model, the platform helps citizens and decision-makers anticipate hydrological crises (droughts and floods).

---

##  Key Features

* **National Overview:** Real-time tracking of total stored volume, weighted national average, and critical facilities, with automated PDF report generation.
* **Interactive Map (GIS):** Spatial visualization of dams by hydrological basin on an interactive map of Morocco (Leaflet integration) with semantic color coding and urban landmarks.
* **7-Day Predictions (Machine Learning):** Predictive modeling powered by a `HistGradientBoostingRegressor` algorithm utilizing historical water levels and weather data (temperature, rainfall).
* **Crisis Simulator:** An interactive tool allowing users to manually adjust temperature increases and rainfall levels to simulate climate impacts on the future trajectory of dams.

---

## Technical Stack

* **Frontend:** React, Vite, Tailwind CSS (v4), Recharts (charts), React-Leaflet (mapping), Lucide React (icons), jsPDF (exports).
* **Backend:** Python, FastAPI, Scikit-Learn (Machine Learning), Pandas, NumPy.
* **Containerization:** Docker & Docker Compose.

---

## Project Structure

```text
AquaSafeAI/
├── backend/
│   ├── ml/                  # Machine Learning models and scripts
│   ├── tests/               # Unit and integration tests
│   ├── database.py          # Database management
│   ├── main.py              # FastAPI entry point
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── public/              # Assets (logos, images)
│   ├── src/
│   │   ├── pages/           # Views (Overview, SpatialMap, Predictions, Simulation, Login)
│   │   ├── services/        # API calls and hydro services
│   │   ├── App.jsx
│   │   └── index.css
│   ├── Dockerfile
│   └── package.json
└── docker-compose.yml
