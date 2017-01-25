import L2LClient from "lively.2lively/client.js";
import { string, num, promise, fun } from "lively.lang";
import { Channel } from "./channel.js";


export class L2LChannel extends Channel{
  constructor(senderRecvrA, onReceivedMethodA, senderRecvrB, onReceivedMethodB){
      console.log(super)
      super(senderRecvrA, onReceivedMethodA, senderRecvrB, onReceivedMethodB);
      if (!this.senderRecvrA.l2lclient){ this.senderRecvrA.l2lclient = L2LChannel.makeL2LClient() }      
      if (!this.senderRecvrB.l2lclient){ this.senderRecvrB.l2lclient = L2LChannel.makeL2LClient() }
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
    var l2lB = senderB.l2lclient    
    l2lB.sendTo(l2lB.trackerId,'listRoom',{roomName: l2lB.socketId.split('#')[1]},(a) => {ackFn(a)})    
  }
  
  isOnline() { return this.online; }
  
  goOffline() {
    console.log(this)
    this.online = false;
    
    var l2lA = this.senderRecvrA.l2lclient,
    l2lB = this.senderRecvrB.l2lclient
    if(!l2lA){ console.log('l2lA Missing');return}
    if(!l2lB){ console.log('l2lB Missing');return}
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

  

  
  
}