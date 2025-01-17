const usdFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',

    // These options are needed to round to whole numbers if that's what you want.
    //minimumFractionDigits: 0, // (this suffices for whole numbers, but will print 2500.10 as $2,500.1)
    //maximumFractionDigits: 0, // (causes 2500.99 to be printed as $2,501)
});

export const formatUSD = (val: string | number): string => usdFormatter.format(parseFloat(val.toString()));

export const compactHash = (val = ''): string => {
    if(val.length !== 66){
        return val.substring(0, 6).concat('... ');
    }
    return val.substring(0, 6).concat('...').concat(val.substring(62));
}