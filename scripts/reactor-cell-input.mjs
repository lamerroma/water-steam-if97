// Converts official WIMS input units to the course cell API; no EOS or power input.
export function reactorBenchmarkCellInput(ref,c){
 const g=ref.geometry,f=ref.atomDensitiesPerCM3.fuel,z=ref.atomDensitiesPerCM3.clad;
 const area=r=>Math.PI*r*r,V0=area(g.fuelRadiusCM),Vgas=area(g.cladInnerRadiusCM)-V0,Vzr=area(g.cladOuterRadiusCM)-area(g.cladInnerRadiusCM),Vcell=area(g.cellRadiusCM);
 if(c.boricAcidGL!==0)throw Error('Dissolved boron is not supported by this cell screening.');
 const B=c.radialBucklingCM2+c.axialBucklingCM2;
 if(Math.abs(B*1e4-c.measuredBucklingM2)>1e-10)throw Error('Buckling units or case identity disagree.');
 const Nwater=c.waterAtomDensitiesPerCM3.O16;
 return {geometry:{fuelAreaCM2:V0,gasAreaCM2:Vgas,metalAreaCM2:Vzr,totalAreaCM2:Vcell,fuelDiameterCM:2*g.fuelRadiusCM,boreDiameterCM:0,cladDiameterCM:2*g.cladOuterRadiusCM,pitchCM:g.pitchCM,lattice:g.lattice},material:{rhoWater:Nwater*18.01528/6.02214076e23,fuelDensity:g.fuelDensityGCM3,N5:f.U235,N8:f.U238,NO:f.O16,NZr:z.Zr*Vzr/(Vgas+Vzr),Nwater},temperature:{waterK:c.temperatureK,fuelC:c.temperatureK-273.15},options:{resonanceMethod:'gp',resonanceI8:22,bellFactor:1.27,squareBoundaryGamma:1},leakage:{materialBucklingCM2:B}};
}
