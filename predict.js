var CSRandom = require('./cs-random.js');
var XXH = require('./xxhash.min.js');

// These helper functions mimic the RNG wrappers of Stardew 1.6
function getRandomSeed(a, b = 0, c = 0, d = 0, e = 0) {
    // Calculates seed value based on logic of StardewValley.Utility.CreateRandomSeed()
    // Note that we will call this directly always rather than using a "DaySave" wrapper because most of our predictions
    // iterate over multiple days. The standard DaySave wrapper sets a = days played and b = gameID/2
    if (save.useLegacyRandom) {
        return Math.floor((a % 2147483647 + b % 2147483647 + c % 2147483647 + d % 2147483647 + e % 2147483647) % 2147483647);
    } else {
        return getHashFromArray(a % 2147483647, b % 2147483647, c % 2147483647, d % 2147483647, e % 2147483647);
    }
}

function getHashFromString(value) {
    // JS implementation of StardewValley.Utility.GetDeterministicHashCode() with string argument
    var TE = new TextEncoder();
    var H = XXH.h32();
    return H.update(TE.encode(value).buffer).digest().toNumber();
}

function getHashFromArray(...values) {
    // JS implementation of StardewValley.Utility.GetDeterministicHashCode() with int array argument
    var array = new Int32Array(values);
    var H = XXH.h32();
    return H.update(array.buffer).digest().toNumber();
}

var save = {
    daysPlayed: 1,
    gameID: 0,
    year: 1,
    seasonNames: ['Spring', 'Summer', 'Fall', 'Winter'],
    useLegacyRandom: false
};

// Day represents the stardew valley day and contains weather and event info
class Day {
    day;
    weatherTown;
    event;
};

// Month will contain an array of 28 Day objects
class Month {
    days = [];
};

function predictGreenRainForDay(day) {
    var grDays = [5, 6, 7, 14, 15, 16, 18, 23],
        festivalDays = {
            13: "Egg Festival",
            24: "Flower Dance",
            39: "Luau",
            48: "Trout Derby",
            49: "Trout Derby",
            56: "Moonlight Jellies",
            72: "Stardew Valley Fair",
            83: "Sprit's Eve",
            92: "Festival of Ice",
            96: "Squid Fest",
            97: "Squid Fest",
            99: "Night Market",
            100: "Night Market",
            101: "Night Market",
            109: "Winter Star"
        },
        year,
        rng;

    offset = 28 * Math.floor(save.daysPlayed / 28);


    var month = Math.floor(offset / 28);
    var season = month % 4;
    var year = 1 + Math.floor(offset / 112);
    var rng = new CSRandom(getRandomSeed(year * 777, save.gameID));
    var greenRainDay = grDays[rng.Next(grDays.length)];


    var weatherTown = 'Sun';
    if (day == 1 || day == 2 || day == 4 || (day % 28) == 1) {
        weatherTown = 'Sun';
    } else if (day == 3) {
        weatherTown = 'Rain';
    } else if (festivalDays.hasOwnProperty(day % 112)) {
        weatherTown = festivalDays[day % 112];
    } else {
        switch (season) {
            case 0:
            case 2:
                rng = new CSRandom(getRandomSeed(getHashFromString("location_weather"), save.gameID, day - 1));
                var num = rng.NextDouble()
                if (num < 0.183) {
                    weatherTown = 'Rain';
                }
                break;
            case 1:
                // The -28 is because we are only using this for summer
                var dayOfMonth = (day % 112) - 28;
                rng = new CSRandom(getRandomSeed(day - 1, save.gameID / 2, getHashFromString("summer_rain_chance")));
                if (dayOfMonth == greenRainDay) {
                    weatherTown = 'Green Rain';
                } else if (dayOfMonth % 13 == 0) {
                    weatherTown = 'Storm';
                } else {
                    var rainChance = 0.12 + 0.003 * (dayOfMonth - 1);
                    if (rng.NextDouble() < rainChance) {
                        weatherTown = 'Rain';
                    }
                }
                break;
        }
    }

    return weatherTown;
}

function predictEventForDay(day) {
    // logic from StardewValley.Utility.pickFarmEvent()
    var thisEvent,
        day,
        monthName,
        month,
        year,
        rng;

    month = Math.floor(offset / 28);
    monthName = save.seasonNames[month % 4];
    year = 1 + Math.floor(offset / 112);

    var couldBeWindstorm = false;
    // The event is actually rolled in the morning at 6am, but from a user standpoint it makes more sense
    // to think of it occuring during the previous night. We will offset the day by 1 because of this.
    if (day === 30) {
        thisEvent = '<img src="blank.png" class="event" id="train"><br/>Earthquake';
    } else {
        rng = new CSRandom(getRandomSeed(day + 1, save.gameID / 2));
        for (var i = 0; i < 10; i++) {
            rng.NextDouble();
        }
        // If the greenhouse has been repaired, an extra roll for the windstorm needs to happen; because of the
        // order of conditionals, this roll continues to happen even after the tree has fallen.
        if (save.greenhouseUnlocked) {
            couldBeWindstorm = rng.NextDouble() < 0.1;
        }
        // We still would like to check for possible windstorm in saves that don't yet have a greenhouse and in that
        // case we need to reuse the next event roll as the windstorm check.
        var nextRoll = rng.NextDouble();
        if (!save.greenhouseUnlocked) {
            couldBeWindstorm = nextRoll < 0.1;
        }
        // Fairy event chance +.007 if there is a full-grown fairy rose on the farm, but that is too volatile for us.
        if (nextRoll < 0.01 && (month % 4) < 3) {
            thisEvent = 'Fairy';
        } else if (rng.NextDouble() < 0.01 && (day + 1) > 20) {
            thisEvent = 'Witch';
        } else if (rng.NextDouble() < 0.01 && (day + 1) > 5) {
            thisEvent = 'Meteor';
        } else if (rng.NextDouble() < 0.005) {
            thisEvent = 'Stone Owl';
        } else if (rng.NextDouble() < 0.008 && year > 1) {
            thisEvent = 'Strange Capsule';
        } else {
            thisEvent = '(No event)';
        }
    }


    return thisEvent;
};



/* var searchCandidates = [];
var bestRainyDays = 0;
var bestRainyID = 0;

for (id = 999999999; id >= 0; id -= 1) {
    save.gameID = id;
    var month = new Month();
    for (var day = 1; day <= 28; day++) {
        var currentDay = new Day();

        var weather = predictGreenRainForDay(day);
        var event = predictEventForDay(day);
        currentDay.day = day;
        currentDay.weatherTown = weather;
        currentDay.event = event;
        month.days.push(currentDay);
    }
    // Count the number of rainy days in the month
    var rainyDays = month.days.filter(d => d.weatherTown === 'Rain' || d.weatherTown === 'Green Rain' || d.weatherTown === 'Storm').length;

    if (rainyDays > bestRainyDays) {
        bestRainyDays = rainyDays;
        bestRainyID = id;
        console.log("New best: " + bestRainyDays + " rainy days with ID " + bestRainyID);
    }

    if (rainyDays >= 16) {
        // Check for at least 2 Fairy events
        for (var i = 0; i < month.days.length; i++) {
            month.days[i].event = predictEventForDay(month.days[i].day);
        }
        var fairyDays = month.days.filter(d => d.event === 'Fairy').length;
        console.log(fairyDays)
        if (fairyDays >= 2) {
            searchCandidates.push({ id: id, rainyDays: rainyDays, fairyDays: fairyDays, month: month });
            console.log("Found candidate ID " + id + " with " + rainyDays + " rainy days and " + fairyDays + " Fairy events.");
        }
    }
}  */

// Refactor loop as worker threads to speed up search
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

if (isMainThread) {

    var searchCandidates = [];
    var bestRainyDays = 0;
    var bestRainyID = 0;
    var numWorkers = 12;
    var rangePerWorker = Math.floor(1000000000 / numWorkers);
    var completedWorkers = 0;

    console.log("Starting search with " + numWorkers + " workers...");

    for (var w = 0; w < numWorkers; w++) {
        let startID = 999999999 - w * rangePerWorker;
        let endID = startID - rangePerWorker + 1;
        if (w === numWorkers - 1) {
            endID = 0; // Ensure last worker goes to 0
        }
        const worker = new Worker(__filename, { workerData: { startID: startID, endID: endID, save: save } });
        worker.on('message', (msg) => {
            if (msg.type === 'candidate') {
                searchCandidates.push(msg.data);
                console.log("Found candidate ID " + msg.data.id + " with " + msg.data.rainyDays + " rainy days and " + msg.data.fairyDays + " Fairy events.");
            } else if (msg.type === 'best') {
                if (msg.data.rainyDays > bestRainyDays) {
                    bestRainyDays = msg.data.rainyDays;
                    bestRainyID = msg.data.id;
                    console.log("New best: " + bestRainyDays + " rainy days with ID " + bestRainyID);
                }
            } else if (msg.type === 'done') {
                completedWorkers++;
                console.log("Worker completed. " + completedWorkers + "/" + numWorkers + " done.");
                if (completedWorkers === numWorkers) {
                    console.log("All workers complete.");
                    console.log("Best ID found: " + bestRainyID + " with " + bestRainyDays + " rainy days.");
                    console.log("Total candidates found: " + searchCandidates.length);
                    for (var c = 0; c < searchCandidates.length; c++) {
                        console.log("Candidate ID " + searchCandidates[c].id + ": " + searchCandidates[c].rainyDays + " rainy days, " + searchCandidates[c].fairyDays + " Fairy events.");
                        for (var d = 0; d < searchCandidates[c].month.days.length; d++) {
                            console.log("  Day " + searchCandidates[c].month.days[d].day + ": " + searchCandidates[c].month.days[d].weatherTown + ", " + searchCandidates[c].month.days[d].event);
                        }
                    }
                }
            }
        }
        );
        worker.on('error', (err) => {
            console.error("Worker error: ", err);
        });
        worker.on('exit', (code) => {
            if (code !== 0)
                console.error(`Worker stopped with exit code ${code}`);
        });
    }
}
else {
    // Worker thread
    var save = workerData.save;
    var startID = workerData.startID;
    var endID = workerData.endID;

    for (var id = startID; id >= endID; id -= 1) {
        save.gameID = id;
        var month = new Month();
        for (var day = 1; day <= 28; day++) {
            var currentDay = new Day();

            var weather = predictGreenRainForDay(day);
            var event = predictEventForDay(day);
            currentDay.day = day;
            currentDay.weatherTown = weather;
            currentDay.event = event;
            month.days.push(currentDay);
        }
        // Count the number of rainy days in the month
        var rainyDays = month.days.filter(d => d.weatherTown === 'Rain' || d.weatherTown === 'Green Rain' || d.weatherTown === 'Storm').length;

        parentPort.postMessage({ type: 'best', data: { id: id, rainyDays: rainyDays } });

        if (rainyDays >= 13) {
            // Check for at least 2 Fairy events
            for (var i = 0; i < month.days.length; i++) {
                month.days[i].event = predictEventForDay(month.days[i].day);
            }
            var fairyDays = month.days.filter(d => d.event === 'Fairy').length;
            if (fairyDays >= 2) {
                parentPort.postMessage({ type: 'candidate', data: { id: id, rainyDays: rainyDays, fairyDays: fairyDays, month: month } });
            }
        }
    }
    parentPort.postMessage({ type: 'done' });
}
