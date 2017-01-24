import L2LClient from "lively.2lively/client.js";
import { string, num, promise, fun } from "lively.lang";

export class Channel {
  constructor(senderRecvrA, onReceivedMethodA, senderRecvrB, onReceivedMethodB){
      if (!senderRecvrA) throw new Error("no sender / receiver a!");
      if (!senderRecvrB) throw new Error("no sender / receiver b!");
      if (typeof senderRecvrA[onReceivedMethodA] !== "function") throw new Error(`sender a has no receive method ${onReceivedMethodA}!`);
      if (typeof senderRecvrB[onReceivedMethodB] !== "function") throw new Error(`sender b has no receive method ${onReceivedMethodB}!`);
      // var l2lA = Channel.makeL2LClient(),
      // l2lB = Channel.makeL2LClient();      
      this.senderRecvrA = senderRecvrA;
      this.senderRecvrA.l2lclient ? {} : this.senderRecvrA.l2lclient = Channel.makeL2LClient()
      this.onReceivedMethodA = onReceivedMethodA;
      this.onReceivedMethodB = onReceivedMethodB;
      this.senderRecvrB = senderRecvrB;
      this.senderRecvrB.l2lclient ? {} : this.senderRecvrB.l2lclient = Channel.makeL2LClient()
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
    var status = {senderRecvrA : null,senderRecvrB : null}
    if (this.senderRecvrA && this.senderRecvrA.l2lclient) {
      this.senderRecvrA.l2lclient.remove()
      console.log('senderRecvrA disconnected')
      status.senderRecvrA = 'offline'
    } else {
      status.senderRecvrA = 'online'
      console.log('senderRecvrA not disconnected');
      
    }
    if (this.senderRecvrB && this.senderRecvrB.l2lclient) {
      this.senderRecvrB.l2lclient.remove()
      console.log('senderRecvrB disconnected')
      status.senderRecvrB = 'offline'
    } else {
      console.log('senderRecvrB not disconnected');
      status.senderRecvrB = 'online'
    }
    return status
  }

  async goOnline() {    
    await this.senderRecvrA.l2lclient.whenRegistered(300)
    await this.senderRecvrB.l2lclient.whenRegistered(300)
    
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