import L2LClient from "lively.2lively/client.js";
import { string, num, promise, fun } from "lively.lang";

export class Channel {
  constructor(senderRecvrA, onReceivedMethodA, senderRecvrB, onReceivedMethodB){
      if (!senderRecvrA) throw new Error("no sender / receiver a!");
      if (!senderRecvrB) throw new Error("no sender / receiver b!");
      if (typeof senderRecvrA[onReceivedMethodA] !== "function") throw new Error(`sender a has no receive method ${onReceivedMethodA}!`);
      if (typeof senderRecvrB[onReceivedMethodB] !== "function") throw new Error(`sender b has no receive method ${onReceivedMethodB}!`);           
      this.senderRecvrA = senderRecvrA;
      if (!this.senderRecvrA.l2lclient){ this.senderRecvrA.l2lclient = Channel.makeL2LClient() }
      this.onReceivedMethodA = onReceivedMethodA;
      this.onReceivedMethodB = onReceivedMethodB;
      this.senderRecvrB = senderRecvrB;
      if (!this.senderRecvrB.l2lclient){ this.senderRecvrB.l2lclient = Channel.makeL2LClient() }
      this.queueAtoB = [];
      this.queueBtoA = [];
      this.delayAtoB = 0;
      this.delayBtoA = 0;
      this.online = false;
      this.lifetime = 100;
      // this._watchdogProcess = null
      this.goOnline();
  }

  static makeL2LClient(hostname,port, namespace,io){
    var client = L2LClient.forceNew({})
    return client
  }

  registerReceive(client,method){
    var l2l = client.l2lclient;
    l2l.addService("lively.sync", (tracker, msg, ackFn, sender) => {
        method(msg.data)
    });
  }
  
  async getSessions(senderA,senderB,ackFn){
    var l2lA = senderA.l2lclient,
    l2lB = senderB.l2lclient
    var returnVal = 'incomplete';
    l2lB.sendTo(l2lB.trackerId,'listRoom',{roomName: l2lB.socketId.split('#')[1]},(a) => {ackFn(a)})    
  }
  toString() {
    return `<channel ${this.senderRecvrA}.${this.onReceivedMethodA} – ${this.senderRecvrB}.${this.onReceivedMethodB}>`
  }

  isOnline() { return this.online; }
  
  goOffline() {
    console.log(this)
    this.online = false;
    
    var l2lA = this.senderRecvrA.l2lclient,
    l2lB = this.senderRecvrB.l2lclient
    if(!l2lA){ console.log('l2lA Missing');return''}
    if(!l2lB){ console.log('l2lB Missing');return''}
    l2lA.sendTo(l2lA.trackerId,'leaveRoom',{roomName: l2lB.socketId.split('#')[1]})
    
    if (this.senderRecvrA && this.senderRecvrA.l2lclient) {
      this.senderRecvrA.l2lclient.remove()
      console.log('senderRecvrA disconnected')
      
    } else {      
      console.log('senderRecvrA not disconnected');      
    }
    
    if (this.senderRecvrB && this.senderRecvrB.l2lclient) {
      this.getSessions(this.senderRecvrA,this.senderRecvrB,(a)=> {
        if(a.data.length <= 1){
          l2lB.sendTo(l2lB.trackerId,'leaveRoom',{roomName: l2lB.socketId.split('#')[1]})  
          l2lB.remove();          
        } else {
          console.log('senderRecvrB not disconnected');
        }    
      })
    }
    
  }

  async goOnline() {
    var l2lA = this.senderRecvrA.l2lclient,
    l2lB = this.senderRecvrB.l2lclient
    await l2lA.whenRegistered(300)
    await l2lB.whenRegistered(300)
    
    this.registerReceive(this.senderRecvrA,this.senderRecvrA.receiveOpsFromMaster)
    this.registerReceive(this.senderRecvrB,this.senderRecvrB.receiveOpsFromClient)
    
    l2lA.sendTo(l2lA.trackerId,'joinRoom',{roomName: l2lB.socketId.split('#')[1]})
    l2lB.sendTo(l2lB.trackerId,'joinRoom',{roomName: l2lB.socketId.split('#')[1]})
    this.online = true;
    this.watchdogProcess();
  }

  watchdogProcess() {
    if (!this.isOnline() || this._watchdogProcess) return;

    this._watchdogProcess = setTimeout(() => {
      this._watchdogProcess = null;
      if (this.queueAtoB.length) this.send([], this.senderRecvrA);
      else if (this.queueBtoA.length) this.send([], this.senderRecvrB);
      else return;
    }, 800 + num.random(50));
  }

  isEmpty() {
    return !this.queueBtoA.length && !this.queueAtoB.length;
  }

  waitForDelivery() {
  }

  componentsForSender(sender) {
  }

  send(content, sender) {
    

    return this.deliver(sender);
  }

  deliver(sender) {
  }

  
  
}