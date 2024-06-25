import axios from 'axios'

/**
 * LTL 
 * TAILGATE
 */

class Freightcom {
  constructor({ token }) {
    this.token_ = token
    this.services = this.servicesEndpoints_()
    this.rate = this.rateEndPoints_()
    this.shipments = this.shipmentEndPoints_()
    this.finance = this.financeEndPoints_()
  }

  servicesEndpoints_ = () => {
    return {
        getServices: async () => {
            const path = `/services`;
            return this.client_({
              method: 'GET',
              url: path,
            })
            .then(({data}) => data)
            .catch((err) => {
                console.log(err)
                throw new Error('Freightcom : Failed to fetch services')
            })
        }
    }
  }
  
  rateEndPoints_ = () => {
    return {
        requestRateEstimate: async (data) => {
            const path = `/rate`;
            return this.client_({
              method: 'POST',
              url: path,
              data: JSON.stringify({...data})
            })
            .then(({data}) =>{ 
              return data
            })
            .catch((err) => {
                console.error("freightCom error", err)
                throw new Error('Freightcom : Failed to create the rate estimate');
            })
        },
        retriveRatebyId: async (id) => {
            const path = `/rate/${id}`;
            return this.client_({
              method: 'GET',
              url: path,
            })
            .then(({data}) => data)
            .catch((err) => {
                console.log(err)
                throw new Error('Freightcom : Failed to fetch rate estimates by id');
            })
        }
    }

  }

  shipmentEndPoints_ = () => {
    return {
        createShipment: async (data) => {
            const path = `/shipment`;
            return this.client_({
              method: 'POST',
              url: path,
              data: {
                ...data
              }
            })
            .then((res) => res)
            .catch((err) => {
                console.log(err)
                throw new Error('Freightcom : Failed to create the shipment');
            })
        },
        retriveShipmentbyId: async (id) => {
            const path = `/shipment/${id}`;
            return this.client_({
              method: 'GET',
              url: path,
            })
            .then(({shipment}) => shipment)
            .catch((err) => {
                console.log(err)
                throw new Error('Freightcom : Failed to fetch the shipment by id');
            })
        },
        cancelShipment: async(id) => {
            const path = `/shipment/${id}`;
            return this.client_({
              method: 'DELETE',
              url: path,
            })
            .then((res) => res)
            .catch((err) => {
                console.log(err)
                throw new Error('Freightcom : Failed to cancel the shipment');
            })
        },
        trackingShipment: async(id) => {
            const path = `/shipment/${id}/tracking-events`;
            return this.client_({
              method: 'GET',
              url: path,
            })
            .then(({events}) => events)
            .catch((err) => {
                console.log(err)
                throw new Error('Freightcom : Failed to track the shipment by id');
            })
        }

    }
  }

  financeEndPoints_ = () => {
    return {
        getPaymentMethods: async () => {
            const path = `/finance/payment-methods`;
            return this.client_({
                method: 'GET',
                url: path,
            })
            .then((res) => res)
            .catch((err) => {
                console.log(err)
                throw new Error('Freightcom : Failed to fetch payment methods');
            })
        }
    }
  }
  
}

export default Freightcom