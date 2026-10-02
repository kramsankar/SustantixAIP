
window.AIP_V431_AUDIT={
 release:'v431',
 baseline:'v430',
 scope:'Assistant UI cleanup + governed crew-certification query',
 changes:[
   'Removed the textarea resize grip / diagonal lines beside Clear',
   'Changed the Assistant command bar from pale green to restrained medium blue',
   'Added a specific governed natural-language intent for crew members without certifications',
   'No-certification query filters the Crew Roster Certification field instead of returning a generic technician summary',
   'Result now shows Technician, Skill, Certification and Availability for qualifying crew members',
   'Query lineage now states the exact certification condition, record population checked, count matched and calculation steps',
   'Generic crew table also exposes Certification so certification-related evidence is visible'
 ],
 engineImpact:'No external AI dependency introduced; execution remains local and governed.'
};
