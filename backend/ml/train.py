import argparse
import logging
import sys

from .config import DAMS_CONFIG, resolve_dam_name
from .store import train_and_save


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Entraîne les modèles des barrages")
    parser.add_argument("--dam", action="append", help="Barrage à entraîner (répétable). Défaut : tous.")
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    dams = [resolve_dam_name(d) for d in args.dam] if args.dam else list(DAMS_CONFIG)

    failures = 0
    for dam in dams:
        try:
            m = train_and_save(dam)["metrics"]
            print(f"✅ {dam:20s} MAE={m['mae_delta']:.4f}  baseline={m['mae_baseline']:.4f}  "
                  f"gain={100 * m['skill_vs_persistence']:.1f}%")
        except Exception as exc:
            failures += 1
            print(f"❌ {dam:20s} {exc}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())