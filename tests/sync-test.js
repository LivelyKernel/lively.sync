/*global declare, it, describe, beforeEach, afterEach,xit*/

import { expect } from "mocha-es6";
import { morph } from "lively.morphic";
import { promise, tree } from "lively.lang";
import { pt, Color, Rectangle } from "lively.graphics";
import { disconnect, disconnectAll, connect } from "lively.bindings";
import { buildTestWorld, destroyTestWorld } from "./helper.js";
import { Client } from "../client.js";
import { Master } from "../master.js";
import { L2LChannel as L2LChannel } from "../l2lchannel.js";
import L2LClient from "lively.2lively/client.js";
import L2LTracker from "lively.2lively/tracker.js";
import { Channel} from "../channel.js";

// System.decanonicalize("mocha-es6", "http://localhost:9011/lively.sync/tests/sync-test.js")
// var env1, env2, env3,
//     client1, client2, master;

var state;

async function setup(nClients) {
  if (!state) state = {};
  if (state.running) teardown();

  var masterEnv = state.masterEnv = await buildTestWorld({type: "world", name: "world", extent: pt(300,300)}, pt(0,0)),
      master = state.master = new Master(masterEnv.world);
  state.masterWorld = masterEnv.world;

  for (var i = 0; i < nClients; i++) {
    let env = state[`env${i+1}`] = await buildTestWorld(masterEnv.world.exportToJSON(), pt(0,300*(i+1))),
        client = state[`client${i+1}`] = new Client(env.world, `client${i+1}`);
    await client.connectToMaster(master);
    state[`world${i+1}`] = env.world;
    connect(env.changeManager, 'changeRecorded', client, 'newChange');
  }
  state.running = true;
}

function teardown() {
  var s = state;
  if (!s) return;
  s.running = false;

  destroyTestWorld(s.masterEnv);

  Object.keys(s).forEach(name => {
    if (name.match(/^env/)) {
      var env = s[name];
      disconnectAll(env.changeManager)
      try {
        destroyTestWorld(env);
      } catch (e) { console.error(e); }
    } else if (name.match(/^client/)) {
      var client = s[name];
      client.disconnectFromMaster();
      client.receive = function() {};
    }
  });
}


describe("messaging between master and client", () => {

  beforeEach(async () => setup(1));
  afterEach(async () => teardown());

  it("single op", async () => {
    var {world1, masterWorld, client1, master} = state;
    world1.fill = Color.green;
    await promise.delay(30);
    expect(master.history).to.have.length(1);
    expect(client1.history).to.have.length(1);
    expect(client1.buffer).to.have.length(0);
    expect(masterWorld.fill).equals(Color.green);
  });

  it("version numbers", async () => {
    var {world1, masterWorld, client1, master} = state;
    world1.fill = Color.green;
    world1.fill = Color.red;
    await client1.synced();
    expect(master.history).to.have.length(2);
    expect(client1.history).to.have.length(2);
    expect(master.history).containSubset([{version: 0}, {version: 1}]);
    expect(client1.history).containSubset([{version: 0}, {version: 1}]);
  });

});

    

describe("lively2lively backchannel tests", function() {
  this.timeout(1*1000)
  before(async() =>{
    testingClient = await L2LClient.forceNew({});
    await testingClient.whenRegistered(300);
  })
  after(async() => {
    await testingClient.remove();
  })
  beforeEach(async () => setup(2));
  afterEach(async () => teardown());

  it("ensure clients have l2l clients", async () => {
    
    var {world1, masterWorld, client1, master} = state;    
    var testChannel = L2LChannel.establish(client1, "receiveOpsFromMaster", master, "receiveOpsFromClient")
   
    expect((testChannel.senderRecvrA.l2lclient) &&  (testChannel.senderRecvrA.l2lclient instanceof L2LClient)).equals(true,'client A not L2LClient')
    expect((testChannel.senderRecvrB.l2lclient) &&  (testChannel.senderRecvrB.l2lclient instanceof L2LClient)).equals(true,'client B not L2LClient')

    await testChannel.whenOnline(300)

    testChannel.goOffline();
  })

  it('ensure clients can share a master', async () => {
    
    var {world1, masterWorld, client1, client2, master} = state;    
    var testChannel = L2LChannel.establish(client1, "receiveOpsFromMaster", master, "receiveOpsFromClient")    
    window.testChannel = testChannel
    expect((testChannel.senderRecvrA.l2lclient) &&  (testChannel.senderRecvrA.l2lclient instanceof L2LClient)).equals(true,'client A not L2LClient')
    expect((testChannel.senderRecvrB.l2lclient) &&  (testChannel.senderRecvrB.l2lclient instanceof L2LClient)).equals(true,'client B not L2LClient')

    await testChannel.whenOnline(300)

    var channelId = testChannel.senderRecvrB.l2lclient.socketId.split('#')[1]

    var testChannel2 = L2LChannel.establish(client2, "receiveOpsFromMaster", master, "receiveOpsFromClient")    
    
    expect((testChannel2.senderRecvrA.l2lclient) &&  (testChannel2.senderRecvrA.l2lclient instanceof L2LClient)).equals(true,'client A not L2LClient')
    expect((testChannel2.senderRecvrB.l2lclient) &&  (testChannel2.senderRecvrB.l2lclient instanceof L2LClient)).equals(true,'client B not L2LClient')

    await testChannel2.whenOnline(300)

    expect(testChannel2.senderRecvrB === testChannel.senderRecvrB).equals(true,'Clients have different masters')
    
    testChannel.goOffline();
    testChannel2.goOffline();
  })

  it('ensure clients can communicate across channel', async () => {
    var {world1, masterWorld, client1, master} = state;  
    var client1Buffer = []
    var masterBuffer = []
    var payload = "Test for lively.sync messaging"
    var ack = 'received'
    function masterCheck(item){      
      masterBuffer.push(item)
    }
    function ackFn(item){
        client1Buffer.push(item)        
        client1.l2lclient.sendTo(master.l2lclient.id,'lively.sync',{payload: ack})
    }
    client1.receiveOpsFromMaster = ackFn;
    master.receiveOpsFromClient = masterCheck;
    
    var testChannel = L2LChannel.establish(client1, "receiveOpsFromMaster", master, "receiveOpsFromClient")

    await testChannel.whenOnline(500)
    
    master.l2lclient.sendTo(client1.l2lclient.id,'lively.sync',{payload: payload})
    await promise.waitFor(200, () => client1Buffer.length  >= 1);
    await promise.waitFor(200, () => masterBuffer.length >= 1);
    testChannel.goOffline();
    expect(client1Buffer[0].payload).equals(payload,'payload not correct')
    expect(masterBuffer[0].payload).equals(ack,'payload not correct')
  })

  it('Temp test, check status of inherited methods',async() => {
    
    var {world1, masterWorld, client1, client2, master} = state;    
    var opChannel = Channel.establish(client1, "receiveOpsFromMaster", master, "receiveOpsFromClient")
    // await opChannel.whenOnline(300)
    var metaChannel = L2LChannel.establish(client1, "receiveOpsFromMaster", master, "receiveOpsFromClient")
    await metaChannel.whenOnline(300)
    console.log({state,opChannel,metaChannel,client1,master})
    opChannel.goOffline()
    metaChannel.goOffline()
    
  })

})


describe("syncing master with two clients", function() {

  // this.timeout(5*1000);
  this.timeout(1*1000);

  beforeEach(async () => setup(2));
  afterEach(async () => teardown());

  it("simple prop", async () => {
    var {world1, world2, masterWorld, client1} = state;
    world1.fill = Color.green
    await client1.synced();
    expect(masterWorld.fill).equals(Color.green);
    expect(world2.fill).equals(Color.green);
  });

  it("adding a morph", async () => {
    var {world1, world2, masterWorld, client1, client2, master} = state;
    world1.addMorph({name: "m1", position: pt(10,10), extent: pt(50,50), fill: Color.red});
    await client1.synced();

    // is morph state completely synced?
    // wont work if inspector is loaded
    //expect(masterWorld.exportToJSON()).deep.equals(world1.exportToJSON(), "masterWorld");
    //expect(world2.exportToJSON()).deep.equals(world1.exportToJSON(), "world2");

    // has morph an owner?
    expect(masterWorld.getSubmorphNamed("m1").owner).equals(masterWorld);
    expect(world2.getSubmorphNamed("m1").owner).equals(world2);

    // is history consistent?
    expect(client1.history).to.have.length(1);
    var expectedChange = {
      target: {type: "lively-sync-morph-ref", id: world1.id},
      type: "method-call",
      selector: "addMorphAt",
      args: [{type: "lively-sync-morph-spec", spec: {name: "m1", position: pt(10,10), extent: pt(50,50)}}, 0]
    }

    expect(client1.history[0].change).containSubset(expectedChange);
    expect(client2.history).to.have.length(1);
    expect(master.history[0].change).containSubset(expectedChange);
    expect(master.history).to.have.length(1);
    
    // are there different morphs in each world?
    var world1Morphs = world1.withAllSubmorphsDo(ea => ea),
        world2Morphs = world2.withAllSubmorphsDo(ea => ea),
        world3Morphs = masterWorld.withAllSubmorphsDo(ea => ea);
    world1Morphs.map((m, i) => {
      expect(m.id)              .equals(world2Morphs[i].id, `morphs ${m.name} (${i}) in world 1 and 2 have not the same id`);
      expect(m.id)              .equals(world3Morphs[i].id, `morphs ${m.name} (${i}) in world 1 and 3 have not the same id`);
      expect(world2Morphs[i].id).equals(world3Morphs[i].id, `morphs ${m.name} (${i}) in world 2 and 3 have not the same id`);
      expect(m)              .not.equals(world2Morphs[i], `morphs ${m.name} (${i}) in world 1 and 2 are identical`);
      expect(m)              .not.equals(world3Morphs[i], `morphs ${m.name} (${i}) in world 1 and 3 are identical`);
      expect(world2Morphs[i]).not.equals(world3Morphs[i], `morphs ${m.name} (${i}) in world 2 and 3 are identical`);
    });

  });

  it("if possible, changes are compacted", async () => {
    var {world1, world2, masterWorld, client1, master} = state;
    var m = world1.addMorph({position: pt(10,10), extent: pt(50,50), fill: Color.red});
    expect().assert(m.env === world1.env, "m has not the env of its world");
    m.moveBy(pt(1,1)); m.moveBy(pt(1,1)); m.moveBy(pt(2,2));
    await client1.synced();
    expect(client1.history).to.have.length(2);
    expect(master.history).to.have.length(2);
    expect(master.history[0]).to.containSubset({change: {type: "method-call", selector: "addMorphAt"}});
    expect(master.history[1]).to.containSubset({change: {type: "setter", prop: "position", value: pt(14,14)}});
  });

  it("sync image", async () => {
    var {world1, client1, env2} = state,
        m = world1.addMorph({type: "image", extent: pt(50,50)});
    await client1.synced();
    // make sure it is rendered correctly
    expect(env2.renderer.getNodeForMorph(env2.world.submorphs[0])).deep.property("childNodes[0].tagName", "IMG");
  });

  it("take client offline then online", async () => {
    var {world1, world2, masterWorld, client1, client2} = state;
    world1.fill = Color.white;
    await client1.synced();
    expect(masterWorld.fill).equals(Color.white);

    client1.goOffline();
    world2.fill = Color.green;
    await client2.synced();
    expect(masterWorld.fill).equals(Color.green);
    expect(world1.fill).equals(Color.white);

    client1.goOnline();
    await client1.synced();
    expect(world1.fill).equals(Color.green);
  });

  it("re-connect client", async () => {
    var {world1, world2, masterWorld, client1, client2, master} = state;
    world1.fill = Color.yellow;
    await client1.synced();
    expect(masterWorld.fill).equals(Color.yellow);

    client1.disconnectFromMaster();
    world2.fill = Color.green;
    await client2.synced();
    expect(masterWorld.fill).equals(Color.green);
    expect(world1.fill).equals(Color.yellow);

    await client1.connectToMaster(master);
    await client1.syncWithMaster();
    expect(world1.fill).equals(Color.green);
  });

  describe("locking", () => {

    it("all participants by one client", async () => {
      var {world1, world2, masterWorld, client1, client2, master} = state;
      world1.fill = Color.green;
      await client1.synced();

      await client1.lockEveryone();
      world2.fill = Color.red;
      await promise.delay(10)
      expect(world1.fill).equals(Color.green, "client1 after lock");
      expect(masterWorld.fill).equals(Color.green, "master after lock");

      await client1.unlockEveryone();
      await client2.synced();

      expect(masterWorld.fill).equals(Color.red);
      expect(world1.fill).equals(Color.red);
    });

    it("twice", async () => {
      var {world1, world2, masterWorld, client1, client2, master} = state;
      await client1.lockEveryone();
      try {
        await client2.lockEveryone();
      } catch (e) {
        expect(e).match(/already locked/i)
        return;
      }
      expect.fail(undefined, undefined, "No error on second lock");
    });


  });


  describe("transforms", () => {


    describe("color conflict", () => {

      it("merge color", async () => {

        // setup(2)
        // teardown();

        var {world1, world2, masterWorld, client1, client2, master} = state;

        var tfm = (op1, op2) => {
          var v1 = op1.change.value,
              v2 = op2.change.value,
              resolvedValue = op1.creator < op2.creator ? v1 : v2
          op1.change.value = resolvedValue;
          op2.change.value = resolvedValue;
          return {op1, op2}
        }

        await client1.setTransforms([tfm])

        // client1.state.transformFunctions = [tfm];
        // client2.state.transformFunctions = [tfm];
        // master.state.transformFunctions =  [tfm];

        world1.fill = Color.green;
        world2.fill = Color.blue;
        await client1.synced() && client2.synced();

        expect(masterWorld.fill).equals(Color.green, "master");
        expect(world1.fill).equals(Color.green, "client1");
        expect(world2.fill).equals(Color.green, "client2");
      });

    });

    describe("position conflict", () => {

      it("resolved into geometric mean", async () => {
        var {world1, world2, masterWorld, client1, client2, master} = state;
        var m = world1.addMorph({name: "m1", position: pt(10,10), extent: pt(50,50), fill: Color.red});
        await client1.synced();
        world1.getSubmorphNamed("m1").position = pt(100,100);
        world2.getSubmorphNamed("m1").position = pt(20,20);
        world2.getSubmorphNamed("m1").position = pt(30,30);
        await client1.synced() && client2.synced();
        expect(world2.getSubmorphNamed("m1").position).equals(world1.getSubmorphNamed("m1").position);
        expect(world2.getSubmorphNamed("m1").position).equals(pt(45,45));

        function posTransform(op1, op2) {
          var c1 = op1.change, c2 = op2.change;
          if (c1.prop === "position" && c2.prop === "position"
           && c1.type === "setter" && c2.type === "setter"
           && c1.target.id === c2.target.id
           && c1.owner.id === c2.owner.id) {
             op1.change = op2.change = Object.assign({}, op1.change, {
               value: c1.value.addPt(c2.value.subPt(c1.value).scaleBy(.5))})
            return {op1, op2, handled: true}
          }
          return {op1, op2, handled: false};
        }

      });

    });

    describe("addMorph", () => {

      it("addMorphs into same owner, order fixed", async () => {
        var {world1, world2, client1, client2} = state,
            m1 = morph({name: "m1", position: pt(10,10), extent: pt(50,50), fill: Color.red}),
            m2 = morph({name: "m2", position: pt(20,20), extent: pt(50,50), fill: Color.green});
        world1.addMorph(m1);
        world2.addMorph(m2);
        await client1.synced() && client2.synced();
        expect(world1.submorphs.map(ea => ea.name)).equals(["m1", "m2"]);
        expect(world2.submorphs.map(ea => ea.name)).equals(["m1", "m2"]);
      });

      it("addMorphs of same morph, one creator wins", async () => {
        var {world1, world2, client1, client2} = state,
            m1 = world1.addMorph({name: "m1", position: pt(10,10), extent: pt(50,50), fill: Color.red}),
            m2 = world1.addMorph({name: "m2", position: pt(20,20), extent: pt(50,50), fill: Color.green}),
            m3 = world1.addMorph({name: "m3", position: pt(30,30), extent: pt(50,50), fill: Color.blue});
        await client1.synced();
        world1.getSubmorphNamed("m2").addMorph(world1.getSubmorphNamed("m1"));
        world2.getSubmorphNamed("m3").addMorph(world2.getSubmorphNamed("m1"));
        await client1.synced() && client2.synced();
        var tree1 = tree.mapTree(world1, (morph, names) => [morph.name, ...names], morph => morph.submorphs),
            tree2 = tree.mapTree(world2, (morph, names) => [morph.name, ...names], morph => morph.submorphs);
        expect(tree1).deep.equals(["world", ["m2", ["m1"]], ["m3"]]);
        expect(tree2).deep.equals(["world", ["m2", ["m1"]], ["m3"]]);
      });

      xit("addMorph, inverse m1 <-> m2", async () => {
        var {world1, world2, client1, client2} = state,
            m1 = world1.addMorph({name: "m1", position: pt(10,10), extent: pt(50,50), fill: Color.red}),
            m2 = world1.addMorph({name: "m2", position: pt(20,20), extent: pt(50,50), fill: Color.green});
        await client1.synced() && client2.synced();

// client2.goOffline();
// client2.goOnline();

        world1.getSubmorphNamed("m1").addMorph(world1.getSubmorphNamed("m2"));
        world2.getSubmorphNamed("m2").addMorph(world2.getSubmorphNamed("m1"));

        await client1.synced() && client2.synced();
        var tree1 = tree.mapTree(world1, (morph, names) => [morph.name, ...names], morph => morph.submorphs),
            tree2 = tree.mapTree(world2, (morph, names) => [morph.name, ...names], morph => morph.submorphs);
        expect(tree1).deep.equals(["world", ["m1", ["m2"]]]);
        expect(tree2).deep.equals(["world", ["m1", ["m2"]]]);
      });

    });
  });

});