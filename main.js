const Discord = require('discord.js');
const client = new Discord.Client();
var fs = require('fs');
var FeedParser = require('feedparser');
var request = require('request');

/// region UTILITY
function log(message) {
    console.log(new Date() + ": " + message);
}
/// endregion

/// region GLOBAL VARIABLES
var currentNews = [];
var postedNews = [];
var postNewsInterval; 
var loadNewsInterval;
var cleanOldNewsInterval;
const postedNewsFilePath = "./postedNews.json";

const postNewsPeriod =  1000 * 3; // 30 sec
const loadNewsPeriod =  60000 * 60 * 24; // 24 hour
const cleanOldNewsPeriod =  1000 * 5; // 24 hour
const maxNumberOfNewsToRemember = 5;
/// endregion

/// ENTRY POINT

/// load all posted rss news
(function loadPostedNewsFromFileSystem(){
    getAll((restoredNews) => {
        postedNews = restoredNews;
        log("Count of restored posted news " + postedNews.length);
        loadAllFeeds();
    });
})();

// Discord related work
client.on('ready', () => {
    log('I am ready!');
    var generalChannel = client.channels.get("25466045464298784169786");
    if (!postNewsInterval) {
        postNewsInterval = setInterval(() => {
            if (currentNews.length === 0) {
                log("No news to show");
                return;// const Discord = require('discord.js');
                // const client = new Discord.Client();
            }
            var articleToPost = currentNews.shift();
            generalChannel.sendMessage(newsToPost.title + " - " + newsToPost.link);
            log("Article is sent to Discord: " + articleToPost.title + " - " + articleToPost.link);
            postedNews.push(articleToPost);
            saveAll(postedNews);
            log("Left in array - " + currentNews.length);
        }, postNewsPeriod);
    }
});

client.login('MjgyNDg5MjQ0MDEyNzczMzc2.C4nUkw.Na6H7ZVrXbMZbXv4Wt9p8cZaj2Q');

/// region DAEMONS
// periodically download news from rss feeds
loadNewsInterval = setInterval(() => {
    log("Updating news");
    loadAllFeeds();
}, loadNewsPeriod);

// periodically remove old news from memory and file system
cleanOldNewsInterval = setInterval(() => {
    while (postedNews.length > maxNumberOfNewsToRemember) {
        var oldNewsToDelete = postedNews.shift();
        log("deleting " + oldNewsToDelete.title + " -" + oldNewsToDelete.link)
    }
    saveAll(postedNews);
}, cleanOldNewsPeriod);
/// endregion

/// region RSS FEED PARSING
// rss.json should contain information about rss, like:
//{
//    "bbc": {
//        "description" : "bbc news",
//        "url" : "https://bbs.com/rss"
//    }
//}
var rssFeeds = require("./rss.json");

/// load feeds from rss.json file to memory (currentNews array)
function loadAllFeeds() {
    for (var feedName in rssFeeds) {
        loadFeed(rssFeeds[feedName].url);
    }
}

function loadFeed(url) {
    var feedparser = new FeedParser();
    request(url).pipe(feedparser);
    feedparser.on('error', (error) => log(error));
    feedparser.on('readable', function () {
        var stream = this;
        var item;
        while (item = stream.read()) {
            if (postedNews && postedNews.some(x => x.title == item.title)) continue;
            if (currentNews.some(x => x.title == item.title)) continue;
            log('Add news to current news array ' + item.link);
            currentNews.push({
                title: item.title,
                link: item.link,
                date: item.date
            });
            if (currentNews.length > 100) currentNews.shift();
        }
    });
}
/// endregion

/// region FILESYSTEM
function getAll(callback)
{
    fs.exists(postedNewsFilePath, (exists) => {
        if (!exists) {
            callback([]);
            return;
        }
        fs.readFile(postedNewsFilePath, {encoding: 'utf-8'}, (err,data) => {
            if (!err) {
                callback(JSON.parse(data));
            } else {
                log(err);
            }
        });
    });
}

function saveAll(data)
{
    fs.writeFile(postedNewsFilePath, JSON.stringify(data), (err) => {
        if(err) {
            log(err);
            return;
        }
    });
}
/// endregion

/// region EXIT PROCESS1
process.stdin.resume();//so the program will not close instantly

function exitHandler(options, exitCode) {
    if (options.cleanup) {
        console.log("Disposing intervals");
        clearInterval(postNewsInterval);
        clearInterval(loadNewsInterval);
        clearInterval(cleanOldNewsInterval);
    }
    if (exitCode || exitCode === 0) console.log(exitCode);
    if (options.exit) process.exit();
}

//do something when app is closing
process.on('exit', exitHandler.bind(null,{cleanup:true}));

//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, {exit:true}));

// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler.bind(null, {exit:true}));
process.on('SIGUSR2', exitHandler.bind(null, {exit:true}));

//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, {exit:true}));

/// endregion EXIT PROCESS1