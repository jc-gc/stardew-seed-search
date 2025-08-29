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
    gameID: 5,
    year: 1,
    seasonNames: ['Spring', 'Summer', 'Fall', 'Winter'],
    useLegacyRandom: false
}

class Weather {
    day;
    weatherTown;
}

class WeatherPrediction {
    weathers = [];
}

function predictGreenRain(isSearch, offset) {
    // Green Rain Day determined by StardewValley.Utility.getDayOfGreenRainThisSummer()
    // Some weather effects determined by Data/LocationContexts
    // Overrides in StardewValley.GameData.getWeatherModificationsForDate()
    var output = "",
        grDays = [ 5, 6, 7, 14, 15, 16, 18, 23 ],
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
        rng,
        tclass;

    if (typeof(offset) === 'undefined') {
        offset = 28 * Math.floor(save.daysPlayed/28);
    }

    var month = Math.floor(offset / 28);
    var season = month % 4;
    var monthName = save.seasonNames[season];
    var year = 1 + Math.floor(offset / 112);
    var rng = new CSRandom(getRandomSeed(year * 777, save.gameID));
    var greenRainDay = grDays[rng.Next(grDays.length)];

    var prediction = new WeatherPrediction();

    for (var week = 0; week < 4; week++) {
        for (var weekDay = 1; weekDay < 8; weekDay++) {
            var day = 7 * week + weekDay + offset;
            var weatherTown = 'Sun';
            if (day == 1 || day == 2 || day == 4 || (day % 28) == 1) {
                weatherTown = 'Sun';
            } else if (day == 3) {
                weatherTown = 'Rain';
            } else if (festivalDays.hasOwnProperty(day % 112)) {
                weatherTown = festivalDays[day % 112];
            } else {
                switch(season) {
                    case 0:
                    case 2:
                        rng = new CSRandom(getRandomSeed(getHashFromString("location_weather"), save.gameID, day-1));
                        output += "Seed: " + getHashFromString("location_weather") + " ";
                       var num = rng.NextDouble()
							output += num;
							if (num < 0.183) {
                            weatherTown = 'Rain';
                        }
                        break;
                    case 1:
                        // The -28 is because we are only using this for summer
                        var dayOfMonth = (day % 112) - 28;
                        rng = new CSRandom(getRandomSeed(day-1, save.gameID/2, getHashFromString("summer_rain_chance")));
                        if (dayOfMonth == greenRainDay) {
                            weatherTown = 'Green Rain';
                        } else if (dayOfMonth % 13 == 0) {
                            weatherTown = 'Storm';
                        } else {
                            var rainChance = 0.12 + 0.003*(dayOfMonth-1);
                            if (rng.NextDouble() < rainChance) {
                                weatherTown = 'Rain';
                            }
                        }
                        break;
                }
            }
            var weather = new Weather();
            weather.day = day;
            weather.weatherTown = weatherTown;

            prediction.weathers.push(weather);
        }
    }

    return prediction;
}

// Loop through possible game IDs to find the id that results in the most rain days
/* var bestID = 0;
var mostDays = 0;

for (var gameID = 1; gameID < 99999999; gameID++) {
    save.gameID = gameID;
    var prediction = predictGreenRain(false, 0);
    var rainDays = 0;
    for (var i = 0; i < prediction.weathers.length; i++) {
        if (prediction.weathers[i].weatherTown == 'Rain' || prediction.weathers[i].weatherTown == 'Green Rain' || prediction.weathers[i].weatherTown == 'Storm') {
            rainDays++;
        }
    }
    if (rainDays > mostDays) {
        mostDays = rainDays;
        bestID = gameID;
        console.log("New Best Game ID: " + bestID + " with " + mostDays + " rain days");
    }
    //console.log("Game ID: " + gameID + " Rain Days: " + rainDays);
}
console.log("Best Game ID: " + bestID);

save.gameID = bestID;
var prediction = predictGreenRain(false, 0);
console.log(prediction); */

// Now Try running the same scan but with multiple threads to speed it up, search different ranges with different threads
if (typeof(window) === 'undefined' && typeof(importScripts) === 'undefined') {
    // Node.js environment
    const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

    if (isMainThread) {
        // Main thread
        const numThreads = 6; // Adjust based on your CPU cores
        const rangePerThread = Math.floor(999999999 / numThreads);
        let completedThreads = 0;
        let globalBestID = 0;
        let globalMostDays = 0;

        for (let i = 0; i < numThreads; i++) {
            const startID = i * rangePerThread + 1;
            const endID = (i === numThreads - 1) ? 999999999 : (i + 1) * rangePerThread;

            const worker = new Worker(__filename, { workerData: { startID, endID } });
            worker.on('message', (message) => {
                if (message.mostDays > globalMostDays) {
                    globalMostDays = message.mostDays;
                    globalBestID = message.bestID;
                    console.log(`New Global Best Game ID: ${globalBestID} with ${globalMostDays} rain days`);
                }
            });
            worker.on('exit', () => {
                completedThreads++;
                if (completedThreads === numThreads) {
                    console.log(`Final Best Game ID: ${globalBestID} with ${globalMostDays} rain days`);
                }
            });
        }
    } else {
        // Worker thread
        const { startID, endID } = workerData;
        let bestID = 0;
        let mostDays = 0;

        for (let gameID = startID; gameID <= endID; gameID++) {
            save.gameID = gameID;
            var prediction = predictGreenRain(false, 0);
            var rainDays = 0;
            for (var i = 0; i < prediction.weathers.length; i++) {
                if (prediction.weathers[i].weatherTown == 'Rain' || prediction.weathers[i].weatherTown == 'Green Rain' || prediction.weathers[i].weatherTown == 'Storm') {
                    rainDays++;
                }
            }
            if (rainDays > mostDays) {
                mostDays = rainDays;
                bestID = gameID;
                parentPort.postMessage({ bestID, mostDays });
            }
            //console.log("Game ID: " + gameID + " Rain Days: " + rainDays);
        }
        parentPort.close();
    }
} else if (typeof(importScripts) !== 'undefined') {
    // Web Worker environment
    let bestID = 0;
    let mostDays = 0;

    const { startID, endID } = workerData;

    for (let gameID = startID; gameID <= endID; gameID++) {
        save.gameID = gameID;
        var prediction = predictGreenRain(false, 0);
        var rainDays = 0;
        for (var i = 0; i < prediction.weathers.length; i++) {
            if (prediction.weathers[i].weatherTown == 'Rain' || prediction.weathers[i].weatherTown == 'Green Rain' || prediction.weathers[i].weatherTown == 'Storm') {
                rainDays++;
            }
        }
        if (rainDays > mostDays) {
            mostDays = rainDays;
            bestID = gameID;
            postMessage({ bestID, mostDays });
        }
        //console.log("Game ID: " + gameID + " Rain Days: " + rainDays);
    }
    close();
}