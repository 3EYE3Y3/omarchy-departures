.pragma library

var BUILT_INS = {
    work: ["Laptop", "Charger", "ID", "Lunch"],
    gym: ["Water", "Towel", "Headphones"],
    hockey: ["Skates", "Helmet", "Stick", "Water"],
    airport: ["Passport", "Wallet", "Phone", "Charger", "Bags"],
    school: ["Bag", "Water bottle"],
    fishing: ["Rods", "Tackle", "Water"],
    sport: ["Boots", "Water", "Jacket"],
    shopping: ["Bags", "List"]
}
function clean(value) {
    return String(value || "").replace(/^\s+|\s+$/g, "").replace(/\s+/g, " ")
}

function key(value) {
    var text = clean(value).toLowerCase()
    var matches = ["airport", "hockey", "fishing", "shopping", "school", "work", "gym", "sport"]
    for (var i = 0; i < matches.length; i++) if (text.indexOf(matches[i]) !== -1) return matches[i]
    return text.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "custom"
}

function cleanItems(items) {
    var result = []
    var seen = {}
    var source = Array.isArray(items) ? items : []
    for (var i = 0; i < source.length && result.length < 20; i++) {
        var item = clean(source[i]).slice(0, 50)
        var normalized = item.toLowerCase()
        if (item && !seen[normalized]) { seen[normalized] = true; result.push(item) }
    }
    return result
}

function find(kits, kitKey) {
    var target = key(kitKey)
    var source = Array.isArray(kits) ? kits : []
    for (var i = 0; i < source.length; i++) if (String(source[i].key) === target) return source[i]
    return null
}

function suggested(kits, activity, profile) {
    var kitKey = key(profile && profile !== "custom" ? profile : activity)
    var learned = find(kits, kitKey)
    return { key: kitKey, items: cleanItems(learned ? learned.items : (BUILT_INS[kitKey] || [])), learned: !!learned }
}

function learn(kits, kitKey, items, now) {
    var normalizedKey = key(kitKey)
    var cleaned = cleanItems(items)
    if (!cleaned.length) return Array.isArray(kits) ? kits.slice() : []
    var record = { key: normalizedKey, label: clean(kitKey).slice(0, 80) || normalizedKey, items: cleaned, modifiedAt: Number(now) || Date.now() }
    var result = []
    var replaced = false
    var source = Array.isArray(kits) ? kits : []
    for (var i = 0; i < source.length; i++) {
        if (String(source[i].key) === normalizedKey) { result.push(record); replaced = true }
        else result.push(source[i])
    }
    if (!replaced) result.push(record)
    return result.sort(function(a, b) { return String(a.key).localeCompare(String(b.key)) })
}

function remove(kits, kitKey) {
    var target = key(kitKey)
    return (Array.isArray(kits) ? kits : []).filter(function(kit) { return String(kit.key) !== target })
}

function all(kits) {
    var result = []
    var names = Object.keys(BUILT_INS)
    for (var i = 0; i < names.length; i++) result.push({ key: names[i], label: names[i], items: BUILT_INS[names[i]].slice(), builtIn: true })
    var source = Array.isArray(kits) ? kits : []
    for (var j = 0; j < source.length; j++) {
        var replaced = false
        for (var k = 0; k < result.length; k++) if (result[k].key === source[j].key) { result[k] = source[j]; replaced = true }
        if (!replaced) result.push(source[j])
    }
    return result
}
