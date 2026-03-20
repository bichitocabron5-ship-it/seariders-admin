export function ageAt(birthDate: Date, at: Date) {
  let age = at.getFullYear() - birthDate.getFullYear();
  const m = at.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && at.getDate() < birthDate.getDate())) age--;
  return age;
}

export function minorRules(birthDate: Date, at: Date) {
  const age = ageAt(birthDate, at);
  return {
    age,
    isMinor: age < 18,
    isUnder16: age < 16,
    needsAuthorization: age >= 16 && age < 18,
  };
}
