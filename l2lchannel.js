import L2LClient from "lively.2lively/client.js";
import L2LTracker from "lively.2lively/tracker.js";
import { string, promise } from "lively.lang";

export class L2LChannel {
  constructor(sender, master){
    
  }

  static makeMaster(hostname,port, namespace,io){
    var path;
    hostname ? {} : hostname = 'localhost'
    port ? {} : port = '9011'
    namespace ? {} : namespace = '/l2l'
    io ? path = io.path() : path = '/lively-socket.io'
    var origin = `http://${hostname}:${port}`,
    master = new L2LClient(origin,path,namespace)
    master.open();
    master.register();
    return master;
  }

  toString() {
    return `<channel ${this.senderRecvrA}.${this.onReceivedMethodA} – ${this.senderRecvrB}.${this.onReceivedMethodB}>`
  }

  isOnline() { return this.online; }
  goOffline() { this.online = false; }
  goOnline() { this.online = true; this.watchdogProcess(); }

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
  
  static async create(client,master,options){
    if (options){
      var {hostname, port, namespace, io} = options;
    }
    var connection =  new this(client,master,options);
    await connection.master.whenRegistered(300)
    connection.master.sendTo(connection.master.trackerId,'joinRoom',{roomName: connection.master.socketId.split('#')[1]})
    connection.sender.sendTo(connection.sender.trackerId,'joinRoom',{roomName: connection.master.socketId.split('#')[1]})

    connection.online = true;
    return connection;
  }
  
  isOnline() { return this.online; }
  getMembers(){ return {sender: this.sender, master: this.master}}
  
  async close(){
     this.sender.sendTo(this.sender.trackerId,'leaveRoom',{roomName: this.master.socketId.split('#')[1]})
     this.master.sendTo(this.master.trackerId,'leaveRoom',{roomName: this.master.socketId.split('#')[1]})
    await this.master.remove();
    this.online = false;
  }
}