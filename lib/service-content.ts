import { hourlyVanHire } from "./business";

type ServiceContent = {
  description: string;
  sections: { title: string; text: string }[];
  questions: [string, string][];
  related: string[];
};

export const serviceContent: Record<string, ServiceContent> = {
  "airport-transfers": {
    description: "Book private Auckland Airport pickup or drop-off for domestic and international flights. Request a van, add bags and flight details, and review your NZD quote.",
    sections: [
      { title: "Private pickup and drop-off at Auckland Airport", text: "Request travel between Auckland Airport and your Auckland home, hotel or business address. Choose Domestic or International in the booking form, then enter the other address and your preferred pickup time. Airport transfers are private journeys for your booking group." },
      { title: "Plan for passengers, bags and child seats", text: "The online van option allows up to 10 passengers and 6 bags. Include all bags, and tell operations about prams or oversized items so the actual fit can be checked. Request a child seat or wheelchair assistance before booking; suitable equipment and availability need review." },
      { title: "Your transfer price and confirmation", text: "The online quote uses road distance, journey time and vehicle choice. GST and known compulsory allowances are included in the NZD total. Submit a request without payment; after operations accepts and assigns a driver, you receive your confirmation and pay the driver in person. If online pricing is unavailable, contact operations for a quote." },
    ],
    questions: [
      ["Where do I meet my driver?", "Operations confirms the authorised meeting point for your terminal and vehicle. Check those instructions after collecting your bags, and match the driver and registration with your private booking link. Do not assume the public taxi rank is your meeting point."],
      ["What if my flight is delayed?", "Include your flight number and contact operations if arrival or pickup plans change. Automatic flight monitoring and a free waiting period are not promised; agree revised timing and any price change with operations."],
      ["Can I book an airport transfer to an Auckland hotel or cruise terminal?", "Yes. Enter the hotel street address for hotel travel. For a cruise transfer, use our cruise page to share the ship, terminal, date and luggage details so operations can confirm the meeting point."],
      ["Can I request a transfer overnight?", "Booking requests are open 24/7. Travel at your requested time depends on a suitable driver and vehicle being confirmed; submitting a request does not guarantee availability."],
    ], related: ["cruise-transfers", "auckland-rides", "accessible-travel", "pricing"],
  },
  "auckland-rides": {
    description: "Auckland rides, hotel transfers and group transport in roomy vans. Add luggage and child-seat needs and see your full NZD fare before you book.",
    sections: [
      { title: "Auckland hotel, home and venue transfers", text: "Enter the full pickup and destination addresses for a local Auckland journey, including your hotel entrance or venue details where helpful. Choose a ride now or schedule a future pickup. Coverage and driver availability are checked against your actual journey." },
      { title: "Family and group travel", text: "The online van option supports up to 10 passengers and 6 bags. Declare prams, large suitcases and child-seat needs so operations can check the vehicle. A request for more space or equipment needs confirmation; do not assume every van has the same layout." },
      { title: "A quote for your journey", text: "Road distance, journey time, vehicle choice and applicable allowances determine the NZD total, including GST and known compulsory fees. Quotes are held for five minutes. Changes to your route or requirements need a fresh quote. For several stops with a driver retained between them, request hourly van hire." },
    ],
    questions: [
      ["Can I book for a family member or guest?", "Yes. Use the passenger’s contact details so they receive the private booking link and travel updates. Add coordinator instructions in the notes."],
      ["Are child seats included automatically?", "No. Select the child-seat option and tell operations what is needed. The seat allowance is shown in the quote and suitable equipment must be confirmed."],
      ["Can I add stops?", "Yes. Include planned stops before requesting a quote. Changes after quoting need a new price; for a flexible local itinerary, ask about hourly van hire."],
    ], related: ["airport-transfers", "hourly-van-hire", "business-travel", "pricing"],
  },
  "accessible-travel": {
    description: "Request accessible Auckland transport with ramp, hoist or transfer assistance. Share wheelchair, passenger and luggage needs for vehicle review before payment.",
    sections: [
      { title: "Explain the boarding support you need", text: "Select wheelchair assistance and tell us whether the passenger remains seated in the wheelchair or transfers into a vehicle seat. Choose ramp or hoist requirements, and include support people, service animals and any extra boarding time." },
      { title: "Vehicle suitability before payment", text: "The online accessible option is limited to 4 passengers and 2 bags. Actual seating, wheelchair space and equipment compatibility need operations review. Share chair dimensions and boarding requirements with operations; there is no universal wheelchair fit or equipment guarantee." },
      { title: "Accessible airport and local journeys", text: "Request an Auckland address or either Auckland Airport terminal as pickup or destination. Operations reviews suitable equipment and driver availability before confirmation. Pricing is in NZD including GST and known compulsory allowances; contact us if you need help making the request." },
    ],
    questions: [
      ["Is a wheelchair vehicle guaranteed when I submit the form?", "No. Operations must review your requirements and reserve suitable equipment and a driver. Payment is requested after acceptance."],
      ["Can support people and service animals travel?", "Include them in your request, along with luggage, so operations can check the available space and vehicle suitability."],
      ["Can I use Total Mobility funding?", "Submitting this form does not establish eligibility or subsidy acceptance. Contact operations to check any funding arrangement before booking; no subsidy is included in the online quote."],
    ], related: ["airport-transfers", "auckland-rides", "help", "pricing"],
  },
  "business-travel": {
    description: "Corporate transport in Auckland for staff, clients and guests: airport pickups, recurring travel and hourly van hire, with billing agreed upfront.",
    sections: [
      { title: "Travel for employees, clients and visitors", text: "Arrange Auckland airport pickups, hotel transfers and travel between business addresses. For one journey, use the booking form with the passenger’s contact details. Use the business enquiry form for recurring travel and arrangements involving a booking coordinator." },
      { title: "Practical details for your team", text: "Share passenger numbers, luggage, addresses, preferred times and assistance needs. The online van option allows up to 10 passengers and 6 bags, subject to actual fit. For meetings at several locations, enquire about retaining a van and driver by the hour." },
      { title: "Prices, receipts and billing", text: "Single-journey quotes show a NZD total including GST and known compulsory fees. Card receipts are available after payment through the private booking link. Recurring schedules, reporting needs and invoicing terms require a separate agreement; an enquiry does not open a credit account." },
    ],
    questions: [
      ["Can a coordinator book for someone else?", "Yes. Supply the traveller’s contact details for booking updates and put coordinator instructions in the notes. For recurring arrangements, agree booking contacts with operations."],
      ["Is corporate invoicing automatic?", "No. Operations agrees billing and credit terms separately. A business enquiry does not confirm an account or a vehicle."],
      ["Can we keep a driver between meetings?", "Request hourly van hire with the planned stops, start and finish time. This service is van-only and the itinerary is quoted before confirmation."],
    ], related: ["hourly-van-hire", "airport-transfers", "auckland-rides", "pricing"],
  },
  "north-island-transfers": {
    description: "Private transfers from Auckland across the North Island. Share your destination, stops, group and luggage, and agree the itinerary and price first.",
    sections: [
      { title: "A transfer planned from Auckland", text: "Request a private one-way, return or multi-stop North Island journey departing Auckland. Share your actual destination, travel date and pickup address. The route and operating plan need review, particularly for longer journeys and return travel." },
      { title: "Stops, luggage and vehicle fit", text: "Include comfort breaks, planned stops, all passengers and bags. The online van option allows up to 10 passengers and 6 bags; unusual luggage or accessibility equipment needs a suitability check. Do not rely on a map illustration as a confirmed itinerary or timetable." },
      { title: "Long-distance costs explained", text: "Long journeys can include a driver return allowance as well as road distance, time and vehicle factors. Operations reviews complex routes and any driver rest or accommodation requirements. Agree the full NZD price, inclusions and schedule before confirming travel." },
    ],
    questions: [
      ["Can I request a return or multi-stop transfer?", "Yes. Tell operations about both directions, dates and stops so the complete operating plan can be reviewed and priced."],
      ["Is a long-distance online quote a confirmed booking?", "No. Complex journeys require operations review and a suitable driver and vehicle. Payment is requested after acceptance."],
      ["Should I book a transfer or a tour?", "Choose a transfer for travel between places. If sightseeing stops and the day’s pace are central to your plans, use the private tour planner so operations can review an itinerary."],
    ], related: ["private-tours", "airport-transfers", "accessible-travel", "pricing"],
  },
  "private-tours": {
    description: "Private Auckland sightseeing, North Island day trips and multi-day tours. Choose your stops and pace, then agree the itinerary, inclusions and price.",
    sections: [
      { title: "Private sightseeing and day trips from Auckland", text: "Use the planner to request Auckland sightseeing or a North Island day trip for your own group. Choose places you would like to see, your preferred date and a comfortable pace. Destinations are itinerary requests; operations checks road timing and feasibility before agreement." },
      { title: "Multi-day plans and passenger needs", text: "For a longer tour, share your dates, accommodation preferences, luggage and boarding needs. The online transfer van option supports up to 10 passengers and 6 bags. Larger tour enquiries and equipment requests require a specific vehicle plan and are not confirmed by the planner." },
      { title: "What your private tour quote covers", text: "Operations agrees the route, timings, price and inclusions before confirmation. Attractions, accommodation, guiding and cultural interpretation are included only if expressly quoted. Planner duration estimates are a starting point; traffic, breaks and driver requirements affect the final itinerary." },
    ],
    questions: [
      ["Can I choose my own stops?", "Yes. Add destinations, custom stops and interests in the planner. Operations reviews the route, time at each stop and whether the plan is practical."],
      ["Are attraction tickets or accommodation included?", "Only when explicitly included in your agreed quote. Share any existing reservations and ask operations to identify inclusions before you confirm."],
      ["Is there a fixed per-person tour price?", "Tours are quoted around your group, route and timing. The planner sends an enquiry; it does not take payment or confirm availability."],
    ], related: ["hourly-van-hire", "north-island-transfers", "airport-transfers", "accessible-travel"],
  },
  "cruise-transfers": {
    description: "Private Auckland cruise terminal transfers to the airport, hotels or any local address. Share your ship, luggage and timing for a confirmed pickup.",
    sections: [
      { title: "Auckland cruise pickup and drop-off", text: "Request private transport between your Auckland cruise terminal and Auckland Airport, your hotel or another Auckland address. Send the ship name, sailing date and terminal shown on your cruise documents. Operations agrees an authorised meeting point for the actual berth." },
      { title: "Allow for disembarkation and your onward journey", text: "Include your expected disembarkation time and any flight or check-in deadline. Ship arrival time is not necessarily the time you can leave the terminal. Operations reviews the schedule; do not rely on a fixed airport travel time or a guaranteed connection." },
      { title: "Your group, luggage and transfer quote", text: "The online van option supports up to 10 passengers and 6 bags. Tell us about large suitcases, prams, child seats and wheelchair assistance so fit and equipment can be checked. The full NZD quote includes GST and known compulsory fees; waiting arrangements and changes are agreed before confirmation." },
    ],
    questions: [
      ["Will the driver meet us beside the ship?", "Operations confirms the permitted pickup location for your terminal and vehicle. Access arrangements can differ by berth; do not assume kerbside or ship-side access."],
      ["Can we travel directly from the cruise terminal to Auckland Airport?", "Yes. Include your ship and flight details and expected disembarkation time. Operations reviews pickup and travel timing before accepting the transfer."],
      ["Can we include sightseeing before a flight?", "Request hourly van hire or a private tour and include the flight deadline, luggage and preferred stops. The itinerary and suitable vehicle must be reviewed first."],
    ], related: ["airport-transfers", "hourly-van-hire", "private-tours", "accessible-travel"],
  },
  "hourly-van-hire": {
    description: `Auckland private driver and van hire from NZ$${hourlyVanHire.rateNZD}/hour including GST, ${hourlyVanHire.minimumHours}-hour minimum. Plan meetings, sightseeing or group stops with a reviewed quote.`,
    sections: [
      { title: "An Auckland van and driver for several stops", text: "Request hourly van hire for meetings, hotel pickups, shopping or local sightseeing with your own group. This service is available in vans only. Share pickup and finish addresses, dates, start and finish times, planned stops, passenger numbers and bags." },
      { title: "Guide price for local Auckland hire", text: `From NZ$${hourlyVanHire.rateNZD} per hour per van including GST, with a ${hourlyVanHire.minimumHours}-hour minimum (NZ$${hourlyVanHire.rateNZD * hourlyVanHire.minimumHours}). The guide includes the van, driver, fuel, waiting within the booked period and ${hourlyVanHire.includedKmPerHour} km per booked hour. Extra distance is NZ$${hourlyVanHire.extraKmNZD.toFixed(2)} per km including GST. Time starts at the agreed pickup; any extension requires agreement and is priced in 30-minute blocks.` },
      { title: "Agree the full hire plan before confirmation", text: "Parking, tolls, airport or port access charges and attraction tickets are additional where applicable and are itemised in your agreed quote. Out-of-area travel, special equipment and any travel-to-pickup costs require a separate quote. The standard van allows up to 10 passengers and 6 bags, subject to actual fit. Submitting an enquiry does not reserve a van or take payment." },
    ],
    questions: [
      ["Is the hourly rate per person?", `No. The guide starts at NZ$${hourlyVanHire.rateNZD} per van per hour including GST, with a ${hourlyVanHire.minimumHours}-hour minimum. Operations confirms the total for your actual itinerary before booking.`],
      ["Can I hire a car or executive sedan by the hour?", "Hourly hire is van-only. A particular vehicle make, luxury specification or executive sedan is not offered by this hourly service."],
      ["Can the driver wait while we attend meetings?", "Include the waiting time and all stops in your enquiry. Waiting within the agreed hire period counts as booked time; additional time and distance need agreement."],
      ["Does this rate cover a North Island day trip?", "The guide is for local Auckland hire. Use the private tour or North Island transfer page for longer routes so driver return time, rest and the complete itinerary can be priced."],
    ], related: ["business-travel", "private-tours", "cruise-transfers", "pricing"],
  },
};
