// Primary input transcribed earlier from the official deck; kept equal to the legacy fixture.
export const REACTOR_CELL_REFERENCE = {
  "format": "iaea-zr6-cell-reference",
  "version": 1,
  "sources": {
    "report": "https://www-pub.iaea.org/MTCD/Publications/PDF/Pub1264_web.pdf",
    "description": "https://www-nds.iaea.org/wimsd/wwer.htm",
    "input": "https://www-nds.iaea.org/wimsd/bnchmrk/wlup69/wwercrb.win",
    "locations": "Appendix IV.3, printed pp. 170–172; Table 14.9, printed p. 82; WWERCRB CASE 2 and CASE 3",
    "retrieved": "2026-10-12"
  },
  "identification": "P/E/B/T and code are authoritative; summary and detailed tables reuse short names for different cases.",
  "geometry": {
    "lattice": "hex",
    "pitchCM": 1.27,
    "fuelRadiusCM": 0.38,
    "cladInnerRadiusCM": 0.3875,
    "cladOuterRadiusCM": 0.4525,
    "cellRadiusCM": 0.666798,
    "gapMaterial": "void",
    "fuelDensityGCM3": 10.28,
    "cladDensityGCM3": 6.55,
    "enrichmentAtomPercent": 3.6
  },
  "atomDensitiesPerCM3": {
    "fuel": {
      "U234": 8.04966e+18,
      "U235": 8.25606e+20,
      "U238": 2.20998e+22,
      "O16": 4.5867e+22
    },
    "clad": {
      "Zr": 4.27937e+22,
      "Nb93": 4.24561e+20,
      "Hf178": 6.62969e+18
    }
  },
  "modelOmissions": [
    "U234",
    "Nb93",
    "Hf178",
    "evaluated multigroup nuclear data",
    "bound-water scattering law"
  ],
  "policy": {
    "numericalRootTolerance": 1e-12,
    "kScreeningAbsoluteTolerance": 0.01,
    "meaning": "A predeclared 1% screening goal, not experimental uncertainty or a certified accuracy claim; also compare against the reported buckling interval and EXPerror independently."
  },
  "cases": [
    {
      "code": "p2w2b0t2",
      "parameters": "1.27/3.6/0.0/80",
      "deckCase": 2,
      "detailedTableName": "wwer_cra02",
      "summaryTableName": "wwer_cra05",
      "temperatureK": 353.15,
      "boricAcidGL": 0,
      "waterAtomDensitiesPerCM3": {
        "H1": 6.49709e+22,
        "O16": 3.24855e+22,
        "B11": 0
      },
      "radialBucklingCM2": 0.008118,
      "axialBucklingCM2": 0.001537,
      "measuredBucklingM2": 96.55,
      "reportedBucklingDeviationM2": 1.29,
      "experimentalK": 1,
      "reportedKError": 0.006,
      "publishedWimsIAEA69K": 0.99656,
      "publishedWimsIAEA172K": 0.99474
    },
    {
      "code": "p2w2b0t3",
      "parameters": "1.27/3.6/0.0/130",
      "deckCase": 3,
      "detailedTableName": "wwer_cra03",
      "summaryTableName": "wwer_cra06",
      "temperatureK": 403.15,
      "boricAcidGL": 0,
      "waterAtomDensitiesPerCM3": {
        "H1": 6.24779e+22,
        "O16": 3.1239e+22,
        "B11": 0
      },
      "radialBucklingCM2": 0.007827,
      "axialBucklingCM2": 0.0012,
      "measuredBucklingM2": 90.27,
      "reportedBucklingDeviationM2": 0.91,
      "experimentalK": 1,
      "reportedKError": 0.006,
      "publishedWimsIAEA69K": 0.99506,
      "publishedWimsIAEA172K": 0.99335
    }
  ]
};
// Supplementary geometry reconstruction, not an exact replay of the inaccessible deck.
export const REACTOR_CELL_SUPPLEMENTARY = [
 {code:'p1w2b0t2',temperatureCase:0,pitchCM:1.1,measuredBucklingM2:64.02,reportedBucklingDeviationM2:.49,experimentalK:1,reportedKError:.005},
 {code:'p1w2b0t3',temperatureCase:1,pitchCM:1.1,measuredBucklingM2:59.76,reportedBucklingDeviationM2:.31,experimentalK:1,reportedKError:.005}
];

// Analytical checkpoints with published inputs; not measured fuel temperatures / CHF.
export const REACTOR_PIN_CHECKS = [
  {
    "linear": 15000,
    "expected": {
      "cladOuter": 311.7424785644666,
      "cladInner": 337.64830682534637,
      "fuelSurface": 402.3366728022717,
      "fuelCentre": 470.1583815062044
    }
  },
  {
    "linear": 20000,
    "expected": {
      "cladOuter": 318.9899714192888,
      "cladInner": 353.5310757671285,
      "fuelSurface": 439.78223040302896,
      "fuelCentre": 530.2111753416059
    }
  },
  {
    "linear": 25000,
    "expected": {
      "cladOuter": 326.23746427411095,
      "cladInner": 369.41384470891063,
      "fuelSurface": 477.2277880037862,
      "fuelCentre": 590.2639691770073
    }
  },
  {
    "linear": 30000,
    "expected": {
      "cladOuter": 333.48495712893316,
      "cladInner": 385.2966136506928,
      "fuelSurface": 514.6733456045434,
      "fuelCentre": 650.3167630124088
    }
  }
];
export const REACTOR_CHF_CHECKS = [
  {
    "p": 15.57,
    "G": 4514.0,
    "x": -0.4283,
    "expected": 12.239063450815962
  },
  {
    "p": 15.53,
    "G": 4489.0,
    "x": -0.4225,
    "expected": 11.972869547332838
  },
  {
    "p": 15.5,
    "G": 4484.0,
    "x": -0.4181,
    "expected": 11.786575796389942
  }
];
