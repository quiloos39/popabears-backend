
import { FulfillmentService } from "medusa-interfaces"
import DayAndRossXML from "../utils/dayAndRoss"

class DayAndRoss extends FulfillmentService {
  static identifier = "day-and-ross"

  constructor({ logger, totalsService, claimService, swapService, orderService }, options) {
    super()
    this.options_ = options

    /** @private @const {logger} */
    this.logger_ = logger

    /** @private @const {OrderService} */
    this.orderService_ = orderService

    /** @private @const {TotalsService} */
    this.totalsService_ = totalsService

    /** @private @const {SwapService} */
    this.swapService_ = swapService

    /** @private @const {SwapService} */
    this.claimService_ = claimService

    /** @private @const {AxiosClient} */
    // this.client_ = new Freightcom({
    //   token: 'N3WpdbU29h2zwVBKrS8CcaQ05O12WrbJlW6amyRU7ceWetMz1PPknFh2F0RL5bWg'
    // })

    this.sleep = (waitTimeInMs) => new Promise(resolve => setTimeout(resolve, waitTimeInMs));

  }

  async getFulfillmentOptions() {
    return [
      {
        id: "day-and-ross-regular",
      },
      {
        id: "day-and-ross-tailgate",
      },
    ]
  }


  async validateOption(data) {

      return true;
  }

  // validateFulfillmentData(optionData, data, cart) {
  //   // if optiondata is good we should be running these checks on the checkout page onLoad
  //   return data
  // }

  async validateFulfillmentData(optionData, data, cart) {

    // if (data.id !== "my-fulfillment") {
    //   throw new Error("invalid data")
    // }

    return {
      ...data,
    }
  }



  canCalculate(data, data2, data3) {
    return true;
  }

  /**
   * the second param methodData is from the body of the function for adding notes and stuff 
   */
  async calculatePrice(optionData, methodData, cartData) {

    try {
    const Client = new DayAndRossXML()

    if(optionData.id === 'day-and-ross-regular') {
      const price = Client.getRate2('day-and-ross-regular', cartData);
      return price
    } else if (optionData.id === 'day-and-ross-tailgate') {
      const price = Client.getRate2('day-and-ross-tailgate', cartData);
      return price
    }
    } 
    catch(error){
      console.error('error calculting the price', error)
    }

    
  }

  createOrder() {
    // No data is being sent anywhere
    return Promise.resolve({})
  }

  createReturn() {
    // No data is being sent anywhere
    return Promise.resolve({})
  }

  createFulfillment() {
    // No data is being sent anywhere
    return Promise.resolve({})
  }

  cancelFulfillment() {
    return Promise.resolve({})
  }
}

export default DayAndRoss; 