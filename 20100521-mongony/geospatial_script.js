// use load('this_file.js') in mongo shell

function title_page(){
    msg = ["      Mathias Stearn presents:"
          ,"Geospatial Queries and Other Cool Stuff"
          ,""
          ," http://confmirror.10gen.com/zips.json"
          ,""
          ,"       @mathias_mongo @mongodb"
          ,""
          ,"      #MongoNYC -- May 21, 2010"
          ].join('\n');

    runProgram('sh', '-c', 'echo "' + msg + '" | cowsay -n -T "U  "');
}

function i_am_lost(){
    print("DON'T PANIC");
    help();
    print('\n-----\n');

    db.help();
    print('\n-----\n');

    db.collection.help();
    print('\n-----\n');

    // Any function without () will print code
    // On the REPL, printjson is called for you automatically
    printjson(i_am_lost);
}

function fun_with_arrays(){
    db.arrays.drop();
    db.arrays.insert({_id:1, tags: ['a', 'b', 'c']});
    db.arrays.insert({_id:2, tags: ['b', 'c', 'd']});
    db.arrays.insert({_id:3, tags: ['c', 'd', 'e']});

    db.arrays.find({tags: 'a'}) // 1
    db.arrays.find({tags: 'c'}) // 1, 2, 3
    db.arrays.find({tags: {$in: ['a', 'e']}}) // 1, 3
    db.arrays.find({tags: {$all: ['a', 'e']}}) // none
    db.arrays.find({tags: {$all: ['c', 'd']}}) // 2, 3

    // $slice is new in 1.5.1
    db.arrays.find({_id:1}, {tags: {$slice:1}}) //['a']
    db.arrays.find({_id:1}, {tags: {$slice:-1}}) //['c']
    db.arrays.find({_id:1}, {tags: {$slice:[1,2]}}) //['b', 'c']

    // last two args are upsert (false) and multi (true)
    db.arrays.update({tags:'b'}, {$set: {'tags.$': 'B'}}, false, true);
    db.arrays.find().forEach(printjson);
}

function import_zips() {
    runProgram('wget', '-N', 'http://media.mongodb.org/zips.json');
    runProgram('mongoimport', 'zips.json', '-d', 'geo', '-c', 'zips', '--drop');
}

function play_with_zips() {
    db = db.getSisterDB('geo');
    db.zips.find().limit(2).forEach(printjson);

    //db.zips.ensureIndex({zip:1}) // queries are fast w/o index
    printjson(db.zips.findOne({zip:'10011'}));
    printjson(db.zips.findOne({zip:/^1001/}));
    db.zips.find({zip:{$gte:'1001', $lt:'1002'}}).forEach(printjson);

    printjson(db.zips.count({city:'NEW YORK'}));
    printjson(db.zips.count({city:'NEW YORK', state:{$ne:'NY'}}));
    printjson(db.zips.count({city:/NEW YORK/, state:{$ne:'NY'}}));
    printjson(db.zips.find({city:/NEW YORK/, state:{$ne:'NY'}}));

    printjson(db.zips.count({pop:1}));
    printjson(db.zips.count({pop:0}));
    db.zips.find().sort({pop:-1}).limit(10).forEach(printjson);

    // shameless plug for github.com/RedBeard0531/MongoMagic
}

function geo_with_zips() {
    db = db.getSisterDB('geo');
    db.zips.ensureIndex({loc:'2d', state:1});

    our_loc = db.zips.findOne({zip: '10011'}).loc;
    printjson(our_loc);

    // note our geospatial queries currently assume a flat earth
    db.zips.find({loc: {$near: our_loc}}).limit(5).forEach(printjson);
    printjson(db.runCommand({geoNear:'zips', near:our_loc, num:5}));

    print(db.zips.count({loc: {$within: {$box: [[40, 73], [41, 74]]}}}));
    print(db.zips.count({loc: {$within: {$center: [our_loc, 0.5]}}}));

    print(db.zips.count({loc: {$within: {$center: [our_loc, 0.5]}},
                         state: {$ne: 'NJ'}}));
}

function map_reduce_with_zips() {
    function map1(){ emit(this.state, this.pop);  }
    function reduce1(key, values){ return Array.sum(values);  }
    db.zips.mapReduce(map1, reduce1, {out:'states.simple'});
    print('done with simple');
    printjson(db.states.simple.findOne({_id:'NY'}))

    function map2(){ emit(this.state, {pop:this.pop, count:1});  }
    function reduce2(key, values){
        for (var i=1; i<values.length; i++){
            values[0].count +=  values[i].count;
            values[0].pop +=  values[i].pop;
        }
        return values[0];
    }
    db.zips.mapReduce(map2, reduce2, {out:'states.more'});
    print('done with more');
    db.states.more.find().sort({'value.pop':-1}).limit(5).forEach(printjson);

    function map3(){ emit({state:this.state, city:this.city},
                          {pop:this.pop, count:1}); }
    function avg(key, value){ 
        value.avg = value.pop / value.count;
        return value;
    }
    db.zips.mapReduce(map3, reduce2, {out:'cities', finalize:avg});
    print('done with cities')
    db.cities.find({'_id.state': 'NY'}).sort({'value.pop':-1}).
              limit(5).forEach(printjson);
}

function auto_increment(){
    db.counters.save({_id:'some id', value:0});
    function get(){
        return db.counters.findAndModify({
                    query:{_id:'some id'},
                    update:{$inc:{value:1}}})
    }
    printjson(get()); // {_id: 'my_counter, value: 0}
    printjson(get().value); // 1
    printjson(get().value); // 2
    printjson(get().value); // 3
}
