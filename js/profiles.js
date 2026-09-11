.pragma library

var PROFILE_ORDER = ["custom", "work", "school", "airport", "fishing", "sport", "shopping"]

var PROFILES = {
    custom: { label: "Custom", preparationMinutes: 15, arrivalBufferMinutes: 5, transportMode: "drive", reminders: [] },
    work: { label: "Work", preparationMinutes: 25, arrivalBufferMinutes: 10, transportMode: "drive", reminders: ["Laptop", "Access card", "Charger"] },
    school: { label: "School", preparationMinutes: 15, arrivalBufferMinutes: 5, transportMode: "drive", reminders: ["Bag", "Water bottle"] },
    airport: { label: "Airport", preparationMinutes: 60, arrivalBufferMinutes: 120, transportMode: "drive", reminders: ["Passport", "Wallet", "Charger"] },
    fishing: { label: "Fishing", preparationMinutes: 45, arrivalBufferMinutes: 15, transportMode: "drive", reminders: ["Rods", "Tackle", "Water"] },
    sport: { label: "Sport", preparationMinutes: 30, arrivalBufferMinutes: 20, transportMode: "drive", reminders: ["Boots", "Water", "Jacket"] },
    shopping: { label: "Shopping", preparationMinutes: 10, arrivalBufferMinutes: 0, transportMode: "drive", reminders: ["Bags", "List"] }
}

function profile(name) {
    return PROFILES[String(name || "").toLowerCase()] || PROFILES.custom
}

function options() {
    return PROFILE_ORDER.map(function(name) { return { value: name, label: PROFILES[name].label } })
}

function transportOptions() {
    return [
        { value: "drive", label: "Drive" },
        { value: "walk", label: "Walk" },
        { value: "cycle", label: "Cycle" },
        { value: "transit", label: "Public transport" },
        { value: "rideshare", label: "Taxi / rideshare" },
        { value: "other", label: "Other" }
    ]
}

function transportLabel(value) {
    var choices = transportOptions()
    for (var i = 0; i < choices.length; i++) if (choices[i].value === value) return choices[i].label
    return "Other"
}
