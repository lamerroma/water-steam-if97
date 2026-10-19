"""Exact stoichiometric audit of P04 input identifiability, not a BSW solver.

Run from the repository root:
  python3 scripts/reference/dissociation_input_audit.py
Only the Python standard library is needed. No application coefficients are used.
"""

from fractions import Fraction as F
import json


SPECIES = {
    "CH4": {"C": 1, "H": 4},
    "CH3OH": {"C": 1, "H": 4, "O": 1},
    "CO2": {"C": 1, "O": 2},
    "H2O": {"H": 2, "O": 1},
    "O2": {"O": 2},
    "N2": {"N": 2},
}
COMPONENTS = ("Ar", "CO", "CO2", "H2O", "N2", "Ne", "O2", "SO2")


def elements(stream):
    return {
        element: sum(amount * SPECIES[name].get(element, 0)
                     for name, amount in stream.items())
        for element in ("C", "H", "O", "N")
    }


def combustion(fuel, diluent_n2):
    atoms = SPECIES[fuel]
    # Per mole fuel, complete carbon/hydrogen oxidation to CO2/H2O.
    required_o2 = F(atoms["C"]) + F(atoms["H"], 4) - F(atoms.get("O", 0), 2)
    residual_o2 = F(2, 25)
    air_o2 = required_o2 + residual_o2
    # Deliberately specified binary dry air; not an inferred Steam97Web rule.
    air_n2 = air_o2 * F(79, 21)
    inputs = {fuel: F(1), "O2": air_o2, "N2": air_n2 + diluent_n2}
    products = {"CO2": F(atoms["C"]), "H2O": F(atoms["H"], 2),
                "O2": residual_o2, "N2": inputs["N2"]}
    assert elements(inputs) == elements(products), "Element balance failed"
    total = sum(products.values())
    fractions = {name: products.get(name, F(0)) / total for name in COMPONENTS}
    assert sum(fractions.values()) == 1
    assert all(value >= 0 for value in fractions.values())
    return products, fractions, air_o2 / required_o2, air_n2


def exact(values):
    return {key: str(value) for key, value in values.items()}


def main():
    methane = combustion("CH4", F(0))
    methanol = combustion("CH3OH", F(1, 2) * F(79, 21))
    assert methane[0] == methanol[0], "Product amounts must coincide exactly"
    assert methane[1] == methanol[1], "All eight product fractions must coincide"
    threshold = F(21, 20)
    assert methane[2] == F(26, 25) < threshold
    assert methanol[2] == F(79, 75) > threshold
    # The common N2 tracer estimate assumes every N2 molecule came from air.
    estimated_air_o2 = methane[0]["N2"] * F(21, 79)
    tracer_lambda = estimated_air_o2 / (estimated_air_o2 - methane[0]["O2"])
    assert tracer_lambda == methane[2] and tracer_lambda != methanol[2]
    result = {
        "schema_version": 1,
        "scope": "Exact element balances and ambiguity proof; no dissociation properties evaluated",
        "dry_air_assumption": {"O2_mole_fraction": "21/100", "N2_mole_fraction": "79/100"},
        "common_products_mol_per_mol_fuel": exact(methane[0]),
        "common_eight_component_mole_fractions": exact(methane[1]),
        "cases": [
            {"fuel": "CH4", "additional_N2_mol": "0", "lambda": str(methane[2]),
             "passes_lambda_constraint": False},
            {"fuel": "CH3OH", "additional_N2_mol": str(F(79, 42)),
             "lambda": str(methanol[2]), "passes_lambda_constraint": True},
        ],
        "lambda_min_exclusive": str(threshold),
        "N2_tracer_estimate_for_both": str(tracer_lambda),
        "element_balances_exact": True,
        "composition_equality_exact": True,
        "conclusion": "Product composition alone does not identify lambda without restrictions on fuel and dilution. This does not establish the assumptions or behaviour of Steam97Web.",
        "reference_cases_from_Steam97Web": 0,
        "BSW_correction_validated": False,
    }
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
