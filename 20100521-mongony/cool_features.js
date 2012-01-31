// use load('this_file.js') in mongo shell

function title_page(){
    msg = ["Mathias Stearn presents:"
          ,"   Intro to MongoDB"
          ,""
          ,"@mathias_mongo @mongodb"
          ,"   mathias@10gen.com"
          ].join('\n');

    runProgram('sh', '-c', 'echo "' + msg + '" | cowsay -n -T "U  "');
}

function crud(){
    db.dropDatabase(); // start clean (useful when running multiple times)

    var post = {
        title: "My First Post",
        body: "I wrote something",
        author: "mathias",
    };

    db.posts.save(post); // create or update
    printjson(post);
    print('\n-----\n');

    printjson(post._id.getTimestamp());
    print('\n-----\n');

    post.body += "!";
    post.edited = true;
    db.posts.save(post); // updating
    post = db.posts.findOne({_id: post._id}) // retrieve
    printjson(post);
    print('\n-----\n');

    var comment = {
        _id: ObjectId(),
        by: 'richard',
        text: 'you should write more',
    };
    db.posts.update({_id: post._id}, 
                    {$push: {comments: comment}, $inc: {nComments: 1}});

    var reply = {
        _id: ObjectId(),
        inReplyTo: comment._id,
        by: 'mathias',
        text: 'does this count?',
    };
    db.posts.update({_id: post._id},
                    {$push: {comments: reply}, $inc: {nComments: 1}});

    post = db.posts.findOne({'comments.by': 'richard'})
    printjson(post);
    print('\n-----\n');


    db.posts.update({_id: post._id, 'comments._id': comment._id},
                    {$set: {'comments.$.text': "you shouldn't write more"}});

    db.posts.update({_id: post._id}, {$pull: {comments: {_id: reply._id}},
                                      $inc: {nComments:-1}});


    db.posts.ensureIndex({'comments.by': 1});
    printjson( db.posts.findOne({'comments.by': 'mathias'}) )
    post = db.posts.findOne({'comments.by': 'richard'})
    printjson(post);
    print('\n-----\n');

    ['short', 'sweet', 'stupid'].forEach(function(tag){
        db.posts.update({_id: post._id}, {$addToSet: {tags: tag}});
        db.tags.update({_id: tag}, {$inc: {count:1}}, true/*upsert*/);
    });

    post = db.posts.findOne({tags: 'stupid'})
    printjson(post);
    db.tags.find().forEach(printjson);
    print('\n-----\n');

    print( db.posts.count({tags: {$in: ['smart', 'stupid']}}) );
    print( db.posts.count({tags: {$all: ['smart', 'stupid']}}) );
    print( db.posts.count({tags: {$all: ['short', 'stupid']}}) );
}

function show_oplog(){
    local = db.getSisterDB('local') // "use local" in shell
    local.oplog.$main.find({op:{$ne:'n'}}).forEach(printjson)
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

    db.arrays.find({_id:1}, {tags: {$slice:1}}) //['a']
    db.arrays.find({_id:1}, {tags: {$slice:-1}}) //['c']
    db.arrays.find({_id:1}, {tags: {$slice:[1,2]}}) //['b', 'c']

    // last two args are upsert (false) and multi (true)
    db.arrays.update({tags:'b'}, {$set: {'tags.$': 'B'}}, false, true);
    db.arrays.find().forEach(printjson);
}

function import_zips() {
    runProgram('mongoimport','zips.json', '-d', 'geo', '-c', 'zips', '--drop');
}

function play_with_zips() {
    db = db.getSisterDB('geo');
    db.zips.find().limit(2).forEach(printjson);

    printjson(db.zips.findOne({_id:'10011'}));
    printjson(db.zips.findOne({_id:/^1001/}));
    db.zips.find({_id:{$gte:'1001', $lt:'1002'}}).forEach(printjson);

    printjson(db.zips.count({city:'NEW YORK'}));
    printjson(db.zips.count({city:'NEW YORK', state:{$ne:'NY'}}));
    printjson(db.zips.count({city:/NEW YORK/, state:{$ne:'NY'}}));
    printjson(db.zips.findOne({city:/NEW YORK/, state:{$ne:'NY'}}));

    printjson(db.zips.count({pop:1}));
    printjson(db.zips.count({pop:0}));
    db.zips.find().sort({pop:-1}).limit(10).forEach(printjson);
}

function geo_with_zips() {
    db = db.getSisterDB('geo');
    db.zips.ensureIndex({loc:'2d', state:1});

    our_loc = db.zips.findOne({_id: '10011'}).loc;
    printjson(our_loc);
    print('\n-----\n');

    db.zips.find({loc: {$near: our_loc}}).limit(5).forEach(printjson);
    print('\n-----\n');
    printjson(db.runCommand({geoNear:'zips', near:our_loc, num:5}));
    print('\n-----\n');

    // google for "radius of the earth in km"
    printjson(db.runCommand({geoNear:'zips', near:our_loc, num:5, spherical:true, distanceMultiplier:6378.1}));
    print('\n-----\n');

    print(db.zips.count({loc: {$within: {$box: [[40, 73], [41, 74]]}}}));
    print(db.zips.count({loc: {$within: {$center: [our_loc, 0.5]}}}));

    print(db.zips.count({loc: {$within: {$center: [our_loc, 0.5]}},
                         state: {$ne: 'NJ'}}));
}

function map_reduce_with_zips() {
    // SELECT sum(pop) from zips GROUP BY state
    function map1(){ emit(this.state, this.pop);  }
    function reduce1(key, values){ return Array.sum(values);  }
    db.zips.mapReduce(map1, reduce1, {out:'states.simple'});
    print('done with simple');
    printjson(db.states.simple.findOne({_id:'NY'}))

    // SELECT sum(1) as count, sum(pop) as pop from zips GROUP BY state
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

    // SELECT sum(1) as count, sum(pop), avg(pop) from zips GROUP BY state, city
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
    //db.counters.save({_id:'some id', value:0});
    function get(){
        return db.counters.findAndModify({
                    query:{_id:'some id'},
                    update:{$inc:{value:1}},
                    upsert: true,
                    'new': true});
    }
    printjson(get()); // {_id: 'my_counter, value: 1}
    printjson(get().value); // 2
    printjson(get().value); // 3
    printjson(get().value); // 4
}

function mega_insert() {
    var big_string = 'x';
    while (big_string.length < 1024)
        big_string += big_string;

    for (var i=0; i < 10*1000; i++)
        db.bar.insert({_id:ObjectId(), key:i, big_string:big_string})
}








