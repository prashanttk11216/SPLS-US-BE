import { PhoneNumberFormat, PhoneNumberUtil } from "google-libphonenumber";

export const formatPhoneNumber = (phoneNumber: string | undefined): string => {
  if (!phoneNumber) return "N/A";
  try {
    const phoneUtil = PhoneNumberUtil.getInstance();
    const number = phoneUtil.parse(phoneNumber, "US");
    const nationalFormat = phoneUtil.format(number, PhoneNumberFormat.NATIONAL); // Format as national
    const countryCode = `+${number.getCountryCode()}`; // Add the country code manually
    return `${countryCode} ${nationalFormat}`;
  } catch {
    return phoneNumber; // Return original if parsing fails
  }
};
