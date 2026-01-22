export const emailTemplates = {
  vituity: {
    to: 'RCMInfo@vituity.com',
    subject: 'Dispute of Invalid Debt — Account Sent to Collections Without Insurance Billing',
    body: `To Whom It May Concern:

I am writing regarding services provided on July 19, 2025 at Saint Francis Memorial Hospital.

I have confirmed with my insurance carrier, Blue Cross Blue Shield of Massachusetts, that they never received a claim for these services. My insurance information was provided at the time of service.

Under the No Surprises Act (Public Law 116-260), emergency service providers are required to submit claims to a patient's health insurance before billing the patient directly. Sending a patient to collections without first billing their insurance is a violation of federal law.

I am requesting that you:
1. Immediately recall this account from collections
2. Submit the claim to my insurance (information below)
3. Provide written confirmation that this has been done

My insurance information:
- Carrier: Blue Cross Blue Shield of Massachusetts
- Member ID: [MEMBER_ID]
- Group Number: [GROUP_NUMBER]

Until this claim is properly submitted to my insurance and processed, I dispute this debt as invalid.

Regards,
Willem Thorbecke`,
  },
  igt: {
    to: 'billing@igtradiology.com',
    subject: 'Claim Resubmission Required — Incorrect Eligibility Rejection',
    body: `To Whom It May Concern:

I am writing regarding radiology services provided on July 19, 2025 at Saint Francis Memorial Hospital.

I understand my claim was rejected due to "patient not eligible on service date." This is incorrect — I had active coverage with Blue Cross Blue Shield of Massachusetts on that date.

Please resubmit this claim with the correct insurance information:
- Carrier: Blue Cross Blue Shield of Massachusetts
- Member ID: [MEMBER_ID]
- Group Number: [GROUP_NUMBER]

Please confirm receipt and resubmission of this claim.

Regards,
Willem Thorbecke`,
  },
  ucsf: {
    to: 'patientbilling@sutterhealth.org',
    subject: 'Verification Request — July 19, 2025 ER Visit',
    body: `To Whom It May Concern:

I am writing regarding my account for services provided on July 19, 2025 at Saint Francis Memorial Hospital.

Please verify this claim was properly submitted to my insurance:
- Carrier: Blue Cross Blue Shield of Massachusetts
- Member ID: [MEMBER_ID]
- Group Number: [GROUP_NUMBER]

Please confirm:
1. Was this submitted to BCBS Massachusetts (not California)?
2. What was the insurance response?
3. Please provide an itemized bill.

Regards,
Willem Thorbecke`,
  },
}

export const taskContexts = {
  medical: `I need to dispute medical bills from a July 2025 ER visit. Vituity ($3,801), IGT Radiology ($66), and UCSF/Saint Francis ($5,479) never properly billed my insurance (BCBS Massachusetts) before sending me to collections. This is a No Surprises Act violation.`,
  taxes: `I need to file my 2024 federal taxes. I'm owed a refund. I make about $125,000/year. I also missed filing 2021 taxes and that refund is gone (past the 3-year deadline).`,
  traffic: `I have a speeding ticket in Sonoma County, California. Citation CHPSK33983, speeding over 65 MPH on 7/28/2025. I got an extension until March 13, 2026. I want to do traffic school to keep it off my record. Total is $301 to the court plus ~$25-40 for traffic school.`,
  costco: `I have a Costco Executive membership ($130/year) but I don't have a car anymore after a breakup. I want to downgrade to the basic Gold Star membership ($65/year). I'm in San Francisco.`,
}
