//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

contract User {
    function proxy(
        address _to,
        bytes memory _calldata
    ) public returns (bool success, bytes memory returnData) {
        (success, returnData) = address(_to).call(_calldata);
    }
}

contract EchidnaSetup {
    User user;

    constructor() {
        user = new User();
    }

    function _between(
        uint256 _val,
        uint256 _min,
        uint256 _max
    ) internal pure returns (uint256) {
        return _min + (_val % (_max - _min + 1));
    }
}
