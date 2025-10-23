import React from 'react';
import toast from 'react-hot-toast';

const JobOffersPage = ({ jobOffers, offersLoading, respondToOffer }) => {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Job Offers</h2>
      
      <div className="bg-white shadow rounded-lg p-6">
        {offersLoading ? (
          <div className="text-center py-6">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading job offers...</p>
          </div>
        ) : jobOffers.length === 0 ? (
          <div className="text-center py-6">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No job offers</h3>
            <p className="mt-1 text-sm text-gray-500">You haven't received any job offers yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {jobOffers.map((offer) => (
              <div key={offer.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-medium text-gray-900">
                        {offer.business?.companyName || offer.business?.email || 'Unknown Business'}
                      </h3>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        offer.status === 'pending' 
                          ? 'bg-yellow-100 text-yellow-800'
                          : offer.status === 'accepted'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {offer.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{offer.message}</p>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-500">
                        <span className="font-medium">Salary:</span> ₹{offer.salaryPerDay}/day
                      </div>
                      <div className="text-sm text-gray-500">
                        <span className="font-medium">Sent:</span> {new Date(offer.sentAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
                
                {offer.status === 'pending' && (
                  <div className="mt-4 flex justify-end space-x-3">
                    <button
                      onClick={() => respondToOffer(offer.id, 'rejected')}
                      className="px-4 py-2 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-md"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => respondToOffer(offer.id, 'accepted')}
                      className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md"
                    >
                      Accept
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default JobOffersPage;

