import * as zmq from 'zeromq'
import { encode, decode } from '@msgpack/msgpack'

export class FlockConnection {
  reqSock: zmq.Request
  subSock: zmq.Subscriber
  prefix: string

  constructor (
    obj: any
  ) {
    this.reqSock = new zmq.Request()
    this.subSock = new zmq.Subscriber()
    this.prefix = obj.prefix
  }

  async connect (
    conport: string | null,
    subport: string | null
  ) : Promise<void> {
    if (conport !== null) {
      if (conport.match(/^[0-9]+$/)) {
	conport = `${this.prefix}:${conport}`
      }
      this.reqSock.connect(conport)
    }
    if (subport !== null) {
      if (subport.match(/^[0-9]+$/)) {
	subport = `${this.prefix}:${subport}`
      }
      this.subSock.connect(subport)
    }
  }

  async send (data: any): Promise<any> {
    this.reqSock.send(encode(data))
    const [result] = await this.reqSock.receive()
    return decode(result)
  }

  async subscribe (data: string) {
    this.subSock.subscribe(data)
  }

  async unsubscribe (data: string) {
    this.subSock.unsubscribe(data)
  }
}
